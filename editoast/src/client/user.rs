use anyhow::anyhow;
use authz;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use authz::v2::Authorizer as _;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use editoast_models::prelude::*;
use futures::TryStreamExt;
use futures::future::try_join_all;
use itertools::Either;
use std::collections::HashSet;
use std::sync::Arc;

use editoast_models::PgAuthDriver;

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
    /// Add identities to a new or an already existing user
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
    let regulator = openfga_config.into_regulator(pool).await?;
    let driver = regulator.driver();

    let (users, groups) = tokio::join!(
        async { driver.list_users().await?.try_collect::<Vec<_>>().await },
        async { driver.list_groups().await?.try_collect::<Vec<_>>().await }
    );
    let users = if without_groups {
        let group_members =
            try_join_all(groups?.into_iter().zip(std::iter::repeat(regulator)).map(
                |((group_id, _), regulator)| async move {
                    regulator.group_members(&authz::Group(group_id)).await
                },
            ))
            .await?
            .into_iter()
            .flatten()
            .collect::<HashSet<_>>();
        users?
            .into_iter()
            .filter(|(user_id, _)| !group_members.contains(&authz::User(*user_id)))
            .collect::<Vec<_>>()
    } else {
        users?
    };

    for (id, UserInfo { identities, name }) in &users {
        println!("[{id}]: {name} ({})", identities.join(", "));
    }
    if users.is_empty() {
        tracing::info!("No user found");
    }
    Ok(())
}

/// Add a user
pub async fn add_user(args: AddArgs, pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let driver = PgAuthDriver::new(pool);
    if args.identities.is_empty() {
        println!("No identities provided.");
        return Ok(());
    }
    let created_user = driver
        .ensure_user(&args.name.unwrap_or_default(), &args.identities[0])
        .await?;
    driver
        .add_user_identities(Either::Left(created_user.id), &args.identities[1..])
        .await?;
    println!("User added with id: {}", created_user.id);
    Ok(())
}

/// Get a user
pub async fn user_info(
    InfoArgs { user }: InfoArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;
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
    let authorizer = SystemAuthorizer {
        openfga: regulator.openfga(),
        conn: pool.get().await?,
    };
    let groups = authorizer
        .authorize(authz::v2::user_groups(authz::User(uid)))
        .await?
        .access()
        .await?
        .map_err(|rejection| anyhow!("Authorization failed: {rejection}"))?;

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
    let driver = PgAuthDriver::new(pool);
    let user_identity = match (user_id, user_identity) {
        (Some(user_id), _) => Either::Left(user_id),
        (_, Some(identity)) => Either::Right(identity.clone()),
        _ => unreachable!("ensured by clap"),
    };
    driver
        .add_user_identities(user_identity.clone(), &new_identities)
        .await?;
    Ok(())
}
