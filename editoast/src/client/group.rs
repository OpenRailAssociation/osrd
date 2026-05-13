use anyhow::anyhow;
use anyhow::bail;
use authz;
use authz::Group;
use authz::StorageDriver;
use authz::identity::UserInfo;
use authz::v2::Authorizer;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use editoast_models::prelude::*;

use std::collections::HashSet;
use std::sync::Arc;

use crate::authorizers::Rejection;
use crate::authorizers::SystemAuthorizer;
use crate::authorizers::impossible;

use super::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum GroupCommand {
    /// Create a group
    Create(CreateArgs),
    /// List groups
    List,
    /// Get group information
    Info(InfoArgs),
    /// Add members to a group
    Include(IncludeArgs),
    /// Remove members to a group
    Exclude(ExcludeArgs),
    /// Delete a group
    Delete(DeleteArgs),
}

#[derive(Debug, Args)]
pub struct CreateArgs {
    /// Group name
    name: String,
}

#[derive(Debug, Args)]
pub struct InfoArgs {
    /// Group name
    name: String,
}

#[derive(Debug, Args)]
pub struct IncludeArgs {
    /// Group name
    group_name: String,
    /// Users to add
    users: Vec<String>,
}

#[derive(Debug, Args)]
pub struct ExcludeArgs {
    /// Group name
    group_name: String,
    /// Users to remove
    users: Vec<String>,
}

#[derive(Debug, Args)]
pub struct DeleteArgs {
    /// Group name
    name: String,
}

pub async fn create_group(
    CreateArgs { name }: CreateArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let editoast_models::Group { id, .. } =
        editoast_models::Group::upsert(pool.get().await?, name).await?;
    println!("{id}");
    Ok(())
}

pub async fn list_group(pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let mut conn = pool.get().await?;
    let groups = editoast_models::Group::list(&mut conn, Default::default()).await?;
    if groups.is_empty() {
        tracing::info!("No group found.");
        return Ok(());
    }
    for editoast_models::Group { id, name } in groups {
        println!("[{id}]: {name}");
    }
    Ok(())
}

pub async fn group_info(
    InfoArgs { name }: InfoArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let driver = regulator.driver();
    let system = SystemAuthorizer {
        openfga: regulator.openfga(),
        conn: pool.get().await?,
    };
    let Some(group_id) = driver.get_group_id(&name).await? else {
        tracing::error!(name, "No such group");
        return Ok(());
    };
    let Some(group) = editoast_models::Group::retrieve(pool.get().await?, group_id).await? else {
        tracing::error!(group.id = group_id, "No such group");
        return Ok(());
    };
    let user_ids = match system
        .authorize(authz::v2::group_members(authz::Group(group_id)))
        .await?
        .access()
        .await?
    {
        Ok(user_ids) => user_ids,
        Err(Rejection::NoSuchGroup(_)) => unreachable!("tested above"),
        Err(rejection) => impossible!(rejection),
    };

    println!("id     : {group_id}");
    println!("name   : {}", group.name);
    println!("members:");
    for authz::User(user_id) in user_ids {
        let Some(UserInfo { identities, name }) = driver.get_user_info(user_id).await? else {
            tracing::error!(user.id = user_id, "user not found, skipping it!");
            continue;
        };
        println!("- [{user_id}] {name} ({})", identities.join(", "));
    }
    Ok(())
}

/// Exclude users from a group
pub async fn exclude_group(
    ExcludeArgs { group_name, users }: ExcludeArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    if users.is_empty() {
        bail!("No user specified");
    }

    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let driver = regulator.driver();
    let system = SystemAuthorizer {
        openfga: regulator.openfga(),
        conn: pool.get().await?,
    };

    let Some(group_id) = driver.get_group_id(&group_name).await? else {
        bail!("No such group: '{group_name}'");
    };

    let mut authz_users = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            editoast_models::User::retrieve_by_identity(user, pool.get().await?)
                .await?
                .ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
                .id
        };
        authz_users.insert(authz::User(uid));
    }

    let remove_member = authz::v2::remove_members(authz::Group(group_id), authz_users);
    match system.authorize(remove_member).await?.access().await? {
        Ok(()) => Ok(()),
        Err(Rejection::NoSuchGroup(_)) => unreachable!("tested above"),
        Err(Rejection::NoSuchUser(user_id)) => bail!("No such user {user_id}"),
        Err(rejection) => impossible!(rejection),
    }
}

/// Include users in a group
pub async fn include_group(
    IncludeArgs { group_name, users }: IncludeArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    if users.is_empty() {
        bail!("No user specified");
    }

    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let driver = regulator.driver();
    let system = SystemAuthorizer {
        openfga: regulator.openfga(),
        conn: pool.get().await?,
    };

    let Some(group_id) = driver.get_group_id(&group_name).await? else {
        bail!("No such group: '{group_name}'");
    };

    let mut authz_users = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            editoast_models::User::retrieve_by_identity(user, pool.get().await?)
                .await?
                .ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
                .id
        };
        authz_users.insert(authz::User(uid));
    }

    let add_member = authz::v2::add_members(authz::Group(group_id), authz_users);
    match system.authorize(add_member).await?.access().await? {
        Ok(()) => Ok(()),
        Err(Rejection::NoSuchGroup(_)) => unreachable!("tested above"),
        Err(Rejection::NoSuchUser(user_id)) => bail!("No such user {user_id}"),
        Err(rejection) => impossible!(rejection),
    }
}

pub async fn delete_group(
    DeleteArgs { name }: DeleteArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let driver = regulator.driver();
    let mut conn = pool.get().await?;
    let system = SystemAuthorizer {
        openfga: regulator.openfga(),
        conn: conn.clone(),
    };
    let group_id = if let Some(id) = driver.get_group_id(&name).await? {
        id
    } else {
        anyhow::bail!("group '{name}' could not be deleted (not found)");
    };
    let group = Group(group_id);

    // Delete the relationships between the group to be deleted and its members
    let users_in_group = match system
        .authorize(authz::v2::group_members(group))
        .await?
        .access()
        .await?
    {
        Ok(user_ids) => HashSet::from_iter(user_ids),
        Err(Rejection::NoSuchGroup(_)) => unreachable!("tested above"),
        Err(rejection) => impossible!(rejection),
    };
    let remove_member = authz::v2::remove_members(group, users_in_group);
    match system.authorize(remove_member).await?.access().await? {
        Ok(()) => {}
        Err(Rejection::NoSuchGroup(_)) => unreachable!("tested above"),
        Err(Rejection::NoSuchUser(_)) => unreachable!("tested above"),
        Err(rejection) => impossible!(rejection),
    }

    let deleted = editoast_models::Group::delete_static(&mut conn, group_id).await?;
    if deleted {
        tracing::info!("group '{name}' deleted");
    } else {
        anyhow::bail!("group '{name}' could not be deleted (not found)");
    }

    Ok(())
}
