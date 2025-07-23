use std::str::FromStr;
use std::sync::LazyLock;

use fga::client::Client;
use fga::client::InitializationError;
use fga::client::RequestFailure;
use fga::compile_model;
use fga::model::Relation;
use fga::model::Type;
use indexmap::IndexMap;
use indexmap::indexmap;
use itertools::Either;
use sha1::Digest;
use sha1::Sha1;
use tracing::error;
use tracing::info;
use tracing::instrument;

const MIGRATIONS_MODEL: &str = include_str!("../migrations_model.fga");

static OPENFGA_MIGRATIONS: LazyLock<IndexMap<&'static str, &'static str>> = LazyLock::new(|| {
    // The migrations declaration order matches the order in which they will be applied
    #[cfg(not(test))]
    indexmap! {
        "initial_model" => include_str!("../migrations/0_initial_model.fga"),
    }
    #[cfg(test)]
    indexmap! {
        "initial_model" => include_str!("../tests/migrations/0_initial_model.fga"),
        "intermediate_model" => include_str!("../tests/migrations/1_intermediate_model.fga"),
        "final_model" => include_str!("../tests/migrations/2_latest_model.fga"),
    }
});

#[derive(Debug)]
pub enum TargetMigration {
    Latest,
    Name(String),
}

#[derive(fga::Object, Debug, Clone, PartialEq, Eq, Hash)]
/// An openfga migration, defined by its serial number and the SHA1 hash of its related model.
struct Migration(usize, String);

#[derive(fga::User, Debug, Clone, PartialEq, Eq, Hash)]
/// Effectively a constant. We don't need anything from it but Openfga cannot store anything else
/// than tuples so we need to define another type and a relation in addition to the Migration type.
struct Editoast;

fga::relations! {
    Migration {
        apply: Editoast
    }
}

impl Type for Editoast {
    const NAMESPACE: &'static str = "editoast";

    fn id(&self) -> impl ToString {
        "editoast"
    }
}

impl FromStr for Editoast {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s == "editoast" {
            return Ok(Editoast);
        }
        Err(format!("not a valid service: `{}`", s))
    }
}

impl Type for Migration {
    const NAMESPACE: &'static str = "migration";

    fn id(&self) -> impl ToString {
        format!("{}-{}", self.0, self.1)
    }
}

impl FromStr for Migration {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (migration_number, model_hash) = s
            .split_once("-")
            .ok_or("invalid migration identifier".to_string())?;
        let migration_number = migration_number
            .parse::<usize>()
            .map_err(|_| "invalid migration number".to_string())?;
        Ok(Migration(migration_number, model_hash.to_string()))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("Invalid migration name: `{0}`")]
    InvalidMigrationName(String),
    #[error(transparent)]
    InitializationError(#[from] InitializationError),
    #[error(transparent)]
    RequestFailure(#[from] RequestFailure),
    #[error("Inconsistent migrations store state")]
    InconsistantMigrationStore,
}

fn get_migration_index(target_migration: &TargetMigration) -> Result<usize, MigrationError> {
    match target_migration {
        TargetMigration::Latest if OPENFGA_MIGRATIONS.is_empty() => {
            unreachable!("the static migration list should never be empty")
        }
        TargetMigration::Latest => Ok(OPENFGA_MIGRATIONS.len() - 1),
        TargetMigration::Name(migration_name) => OPENFGA_MIGRATIONS
            .get_index_of(&migration_name.as_str())
            .ok_or_else(|| MigrationError::InvalidMigrationName(migration_name.to_string())),
    }
}

#[instrument(name = "migration_run")]
pub async fn run_migrations(
    mut client_authz: Client,
    mut client_migrations: Client,
    target_migration: TargetMigration,
) -> Result<(), MigrationError> {
    // Update the migration store model
    let migration_number = get_migration_index(&target_migration)?;
    let migration_model_dsl = OPENFGA_MIGRATIONS[migration_number];
    let migration_name = *OPENFGA_MIGRATIONS.get_index(migration_number).unwrap().0;
    info!(
        migration_number,
        migration_name, "Retrieved DSL model of target migration",
    );
    let migrations_store_model = compile_model(MIGRATIONS_MODEL);
    client_migrations
        .update_authorization_model(&migrations_store_model)
        .await?;

    // Check for an existing migration tuple
    let mut hasher = Sha1::new();
    hasher.update(migration_model_dsl);
    let new_model_hash = hasher.finalize();
    let new_model_hash = format!("{new_model_hash:x}");
    let migration = Migration(migration_number, new_model_hash.clone());
    match client_migrations
        .list_objects(Migration::apply().query_objects(&Editoast))
        .await
        .map_err(|err| err.parsing_ok())?
        .as_slice()
    {
        [current_migration] => {
            if current_migration == &migration {
                info!(
                    migration_name,
                    "Nothing to do: target migration is already applied",
                );
                return Ok(());
            }
            info!("Deleting existing migration tuple");
            client_migrations
                .delete_tuples(&[Migration::apply().tuple(&Editoast, current_migration)])
                .await
                .map_err(|err| match err {
                    Either::Left(request_failure) => request_failure,
                    Either::Right(_) => {
                        unreachable!("Removing a single tuple, it should be fine")
                    }
                })?;
        }
        [_, _, ..] => return Err(MigrationError::InconsistantMigrationStore),
        [] => info!("No previous migration tuple found"),
    };

    let new_model = compile_model(migration_model_dsl);
    client_authz.update_authorization_model(&new_model).await?;
    info!(
        model.hash = new_model_hash,
        "Authorization model written to the authorization store"
    );

    client_migrations
        .write_tuples(&[Migration::apply().tuple(&Editoast, &migration)])
        .await
        .map_err(|err| match err {
            Either::Left(request_failure) => request_failure,
            Either::Right(_) => unreachable!("Writing a single tuple, it should be fine"),
        })?;
    info!(
        tuple.migration.number = migration.0,
        tuple.migration.hash = migration.1,
        "Migration tuple saved in the migration store"
    );

    info!(migration_number, migration_name, "Migration applied",);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::Migration;
    use super::MigrationError;
    use super::TargetMigration;
    use super::run_migrations;
    use crate::Editoast;
    use crate::OPENFGA_MIGRATIONS;
    use fga::Client;
    use fga::model::Relation;
    use sha1::Digest;
    use sha1::Sha1;

    pub fn get_latest_model(store_id: &str) -> String {
        let api_url =
            std::env::var("FGA_API_URL").unwrap_or_else(|_| "http://localhost:8091".to_string());
        let api_url_arg = format!("--api-url={}", api_url);
        use std::process::Command;
        // requires https://github.com/openfga/cli
        let store_arg = format!("--store-id={store_id}");
        let output = Command::new("fga")
            .arg("model")
            .arg("get")
            .arg(api_url_arg)
            .arg(store_arg)
            .output()
            .expect(
                "should work if `fga` CLI installed and in $PATH? https://github.com/openfga/cli",
            )
            .stdout;
        String::from_utf8(output).unwrap()
    }

    /// Run a migration and then verify that the migration and authorization store are up to date
    /// with the expected migration. The function panics if the expected and actual states don't
    /// match.
    async fn check_migration_run(
        client_authz: Client,
        client_migrations: Client,
        target_migration: TargetMigration,
        expected_migration: usize,
    ) {
        run_migrations(
            client_authz.clone(),
            client_migrations.clone(),
            target_migration,
        )
        .await
        .expect("Migration run failed");

        // Check that the authorization store is up to date with the latest model
        let expected_model = OPENFGA_MIGRATIONS[expected_migration];
        let latest_model = get_latest_model(&client_authz.store().id);
        assert_eq!(latest_model.trim(), expected_model.trim());

        // Check that the migration store's migration tuple is up to date:
        let tuple_migrations = client_migrations
            .list_objects(Migration::apply().query_objects(&Editoast))
            .await
            .expect("Call to list-objects endpoint failed");
        assert_eq!(tuple_migrations.len(), 1);

        let current_migration = tuple_migrations.first().unwrap();
        let mut hasher = Sha1::new();
        hasher.update(expected_model);
        let expected_model_hash = hasher.finalize();
        let expected_model_hash = format!("{expected_model_hash:x}");
        let expected_migration = Migration(expected_migration, expected_model_hash);
        assert_eq!(current_migration, &expected_migration);
    }

    #[tokio::test]
    async fn migrate_latest() {
        check_migration_run(
            fga::test_client!("authz@"),
            fga::test_client!("migrations@"),
            TargetMigration::Latest,
            OPENFGA_MIGRATIONS.len() - 1,
        )
        .await;
    }

    #[tokio::test]
    async fn migrate_pinned() {
        check_migration_run(
            fga::test_client!("authz@"),
            fga::test_client!("migrations@"),
            TargetMigration::Name("intermediate_model".to_string()),
            1,
        )
        .await;
    }

    #[tokio::test]
    async fn successive_migration_calls() {
        // Repeatedly running migrations should succeed.
        // Note: this test checks the correct deletion of the migration tuples, which is not
        // covered by the other tests since they only run a single migration from a blank state
        // in which there aren't any already existing migration tuples in the migrations store.
        let client_authz = fga::test_client!("authz@");
        let client_migrations = fga::test_client!("migrations@");
        check_migration_run(
            client_authz.clone(),
            client_migrations.clone(),
            TargetMigration::Name("intermediate_model".to_string()),
            1,
        )
        .await;
        check_migration_run(
            client_authz.clone(),
            client_migrations.clone(),
            TargetMigration::Latest,
            OPENFGA_MIGRATIONS.len() - 1,
        )
        .await;
        check_migration_run(
            client_authz.clone(),
            client_migrations.clone(),
            TargetMigration::Latest,
            OPENFGA_MIGRATIONS.len() - 1,
        )
        .await;
        check_migration_run(
            client_authz.clone(),
            client_migrations.clone(),
            TargetMigration::Name("initial_model".to_string()),
            0,
        )
        .await;
    }

    #[tokio::test]
    async fn invalid_migration() {
        // Trying to apply a migration that does not exist fails
        let client_authz = fga::test_client!("authz@");
        let client_migrations = fga::test_client!("migrations@");
        let invalid_migration_target = uuid::Uuid::new_v4().to_string();

        if let Err(MigrationError::InvalidMigrationName(migration_target)) = run_migrations(
            client_authz,
            client_migrations,
            TargetMigration::Name(invalid_migration_target.clone()),
        )
        .await
        {
            assert_eq!(migration_target, invalid_migration_target);
        } else {
            panic!("Expected an invalid migration number error");
        }
    }
}
