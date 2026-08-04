use anyhow::anyhow;
use anyhow::bail;
use authz;
use authz::v2::Authorizer;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use editoast_models::Group;
use editoast_models::User;
use editoast_models::authn::user::AddIdentitiesError;
use editoast_models::authn::user::UserWithIdentities;
use editoast_models::prelude::*;
use futures::TryStreamExt as _;
use std::collections::HashSet;
use std::sync::Arc;

use crate::authorizers::SystemAuthorizer;

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
    /// Skip if one of the identities already exists
    #[arg(long)]
    skip_if_exists: bool,
}

#[derive(Debug, Args)]
pub struct InfoArgs {
    /// Id or identity of the user
    id_or_identity: String,
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
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);

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
        let group_member_access = authz::v2::Protected::from_iter(
            groups?
                .into_iter()
                .map(|group| authz::v2::group_members(authz::Group(group.id))),
        )
        .authorize(&system)
        .await?;
        let Ok(group_members) = group_member_access.access().await?;
        let group_members = group_members.into_iter().flatten().collect::<HashSet<_>>();
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
    AddArgs {
        name,
        identities,
        skip_if_exists,
    }: AddArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    if identities.is_empty() {
        println!("No identities provided.");
        return Ok(());
    }
    if skip_if_exists {
        for identity in &identities {
            let conn = pool.get().await?;
            let user = editoast_models::User::retrieve_by_identity(identity, conn).await?;
            if user.is_some() {
                println!("Skipped: Identity '{identity}' already exists");
                return Ok(());
            }
        }
    }
    let conn = pool.get().await?;
    let created_user =
        editoast_models::User::register(conn, identities, name.unwrap_or_default()).await?;
    println!("User added with id: {}", created_user.id);
    Ok(())
}

/// Get a user
pub async fn user_info(
    InfoArgs { id_or_identity }: InfoArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let uid = if let Ok(id) = id_or_identity.parse::<i64>() {
        id
    } else {
        editoast_models::User::retrieve_by_identity(&id_or_identity, pool.get().await?)
            .await?
            .ok_or_else(|| anyhow!("No user with identity '{id_or_identity}' found"))?
            .id
    };
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);
    let Some(user) = editoast_models::User::retrieve(pool.get().await?, uid).await? else {
        tracing::error!(user.id = uid, "User not found");
        return Ok(());
    };
    let identities = user.get_identities(pool.get().await?).await?;
    let Ok(groups) = system
        .authorize(authz::v2::user_groups(authz::User(uid)))
        .await?
        .access()
        .await?;
    let conn = pool.get().await?;

    println!("id      : {uid}");
    println!("identities: {}", identities.join(", "));
    println!("name    : {}", user.name);
    println!("groups  :");
    for authz::Group(group_id) in groups {
        let Some(group) = Group::retrieve(conn.clone(), group_id).await? else {
            tracing::warn!(group.id = group_id, "group not found, skipping it!");
            continue;
        };
        println!("- [{group_id}] {}", group.name);
    }
    Ok(())
}

/// Delete a user
pub async fn delete_user(
    DeleteArgs { user }: DeleteArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let uid = if let Ok(id) = user.parse::<i64>() {
        id
    } else {
        editoast_models::User::retrieve_by_identity(&user, pool.get().await?)
            .await?
            .ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
            .id
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
