use anyhow::anyhow;
use anyhow::bail;
use authz;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use editoast_models::PgAuthDriver;
use editoast_models::User;
use editoast_models::authn::user::AddIdentitiesError;
use editoast_models::authn::user::UserWithIdentities;
use editoast_models::prelude::*;
use futures::TryStreamExt as _;
use futures::future::try_join_all;
use std::collections::HashSet;
use std::sync::Arc;

use super::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum UserCommand {
    /// List users
    List(ListArgs),
    /// Add a user
    Add(AddArgs),
    /// Get information about a user
    Info(InfoArgs),
    /// Delete a user
    Delete(DeleteArgs),
    /// Add identities to an existing user
    AddIdentities(AddIdentitiesArg),
}

#[derive(Debug, Args)]
pub struct AddIdentitiesArg {
    #[arg(
        long,
        conflicts_with = "user_identity",
        required_unless_present = "user_identity"
    )]
    user_id: Option<i64>,
    #[arg(long)]
    user_identity: Option<String>,
    new_identities: Vec<String>,
}

#[derive(Debug, Args)]
pub struct ListArgs {
    /// Filter out users that are already in a group
    #[arg(long)]
    without_groups: bool,
}

#[derive(Debug, Args)]
pub struct AddArgs {
    /// Name of the user
    name: Option<String>,
    /// Identities of the user
    identities: Vec<String>,
}

#[derive(Debug, Args)]
pub struct InfoArgs {
    /// Id or identity of the user
    user: String,
}

#[derive(Debug, Args)]
pub struct DeleteArgs {
    /// Id or identity of the user
    user: String,
}

/// List users
pub async fn list_user(
    ListArgs { without_groups }: ListArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;

    let (users, groups) = tokio::join!(
        async {
            let conn = pool.get().await?;
            let users = UserWithIdentities::stream(conn)
                .await?
                .try_collect::<Vec<_>>()
                .await?;
            anyhow::Ok(users)
        },
        async {
            let conn = &mut pool.get().await?;
            let groups = editoast_models::Group::list(conn, Default::default()).await?;
            anyhow::Ok(groups)
        }
    );
    let users = if without_groups {
        let group_members =
            try_join_all(groups?.into_iter().zip(std::iter::repeat(regulator)).map(
                |(group, regulator)| async move {
                    regulator.group_members(&authz::Group(group.id)).await
                },
            ))
            .await?
            .into_iter()
            .flatten()
            .collect::<HashSet<_>>();
        users?
            .into_iter()
            .filter(|user| !group_members.contains(&authz::User(user.user.id)))
            .collect::<Vec<_>>()
    } else {
        users?
    };

    for UserWithIdentities {
        user: User { id, name },
        identities,
    } in &users
    {
        println!("[{id}]: {name} ({})", identities.join(", "));
    }
    if users.is_empty() {
        tracing::info!("No user found");
    }
    Ok(())
}

/// Add a user
pub async fn add_user(
    AddArgs { name, identities }: AddArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    if identities.is_empty() {
        println!("No identities provided.");
        return Ok(());
    }
    let conn = pool.get().await?;
    let created_user =
        editoast_models::User::register(conn, identities, name.unwrap_or_default()).await?;
    println!("User added with id: {}", created_user.id);
    Ok(())
}

/// Get a user
pub async fn user_info(
    InfoArgs { user }: InfoArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let driver = regulator.driver();
    let uid = if let Ok(id) = user.parse::<i64>() {
        id
    } else {
        let uid = driver.get_user_id(&user).await?;
        uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
    };
    let Some(UserInfo { identities, name }) = driver.get_user_info(uid).await? else {
        tracing::error!(user.id = uid, "User not found");
        return Ok(());
    };
    let groups = regulator.user_groups(&authz::User(uid)).await?;

    println!("id      : {uid}");
    println!("identities: {}", identities.join(", "));
    println!("name    : {name}");
    println!("groups  :");
    for authz::Group(group_id) in groups {
        let Some(GroupInfo { name }) = driver.get_group_info(group_id).await? else {
            tracing::warn!(
                group.id = group_id,
                group.name = name,
                "group not found, skipping it!"
            );
            continue;
        };
        println!("- [{group_id}] {name}");
    }
    Ok(())
}

/// Delete a user
pub async fn delete_user(
    DeleteArgs { user }: DeleteArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let driver = PgAuthDriver::new(pool.clone());

    let uid = if let Ok(id) = user.parse::<i64>() {
        id
    } else {
        let uid = driver.get_user_id(&user).await?;
        uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
    };

    let conn = &mut pool.get().await?;
    let deleted = editoast_models::User::delete_static(conn, uid).await?;

    if deleted {
        tracing::info!("user '{user}' deleted");
    } else {
        anyhow::bail!("user '{user}' could not be deleted (not found)");
    }

    Ok(())
}

/// Add identities to an existing user
pub async fn add_identities(
    AddIdentitiesArg {
        user_id,
        user_identity,
        new_identities,
    }: AddIdentitiesArg,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let conn = pool.get().await?;
    let user = match (user_id, user_identity) {
        (Some(user_id), None) => editoast_models::User::retrieve(conn.clone(), user_id).await?,
        (None, Some(identity)) => {
            editoast_models::User::retrieve_by_identity(&identity, conn.clone()).await?
        }
        (Some(_), Some(_)) => unreachable!("ensured by clap"),
        (None, None) => bail!("either a user ID or a user identity must be provided"),
    };
    let Some(user) = user else {
        bail!("no such user");
    };
    let mut identities = HashSet::<_>::from_iter(new_identities);
    while !identities.is_empty() {
        match user.add_identities(conn.clone(), identities.clone()).await {
            Ok(()) => return Ok(()),
            Err(AddIdentitiesError::DuplicateIdentity(identity)) => {
                tracing::warn!(identity, "duplicate identity");
                identities.remove(&identity);
            }
            Err(AddIdentitiesError::Error(err)) => return Err(err.into()),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use editoast_models::authn::user::User;
    use itertools::Itertools as _;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn add_identities_multiple_times() {
        let pool = Arc::new(database::DbConnectionPoolV2::for_tests());

        let conn = pool.get_ok();
        let user = User::register(conn.clone(), vec!["toto".to_owned()], "Toto".to_owned())
            .await
            .expect("user should be created");

        add_identities(
            AddIdentitiesArg {
                user_id: Some(user.id),
                user_identity: None,
                new_identities: vec!["titi".to_owned(), "grosminet".to_owned()],
            },
            pool.clone(),
        )
        .await
        .expect("new identities should succeed");

        add_identities(
            AddIdentitiesArg {
                user_id: Some(user.id),
                user_identity: None,
                new_identities: vec![
                    "mémé".to_owned(),
                    "grosminet".to_owned(),
                    "hector".to_owned(),
                ],
            },
            pool.clone(),
        )
        .await
        .expect("partially new identities should succeed");

        assert_eq!(
            user.get_identities(conn)
                .await
                .unwrap()
                .iter()
                .sorted()
                .collect_vec(),
            vec!["grosminet", "hector", "mémé", "titi", "toto"]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn add_identities_wrong_user_id() {
        let pool = Arc::new(database::DbConnectionPoolV2::for_tests());
        add_identities(
            AddIdentitiesArg {
                user_id: Some(i64::MAX),
                user_identity: None,
                new_identities: vec!["won't_be_added".to_owned()],
            },
            pool,
        )
        .await
        .expect_err("should fail for unknown user id");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn add_identities_wrong_identity() {
        let pool = Arc::new(database::DbConnectionPoolV2::for_tests());
        add_identities(
            AddIdentitiesArg {
                user_id: None,
                user_identity: Some("tom".to_owned()),
                new_identities: vec!["rejected_anyway".to_owned()],
            },
            pool,
        )
        .await
        .expect_err("should fail for unknown user identity");
    }
}
