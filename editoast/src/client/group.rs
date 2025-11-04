use anyhow::anyhow;
use anyhow::bail;
use authz::Group;
use clap::Args;
use clap::Subcommand;

use authz;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;

use database::DbConnectionPoolV2;
use futures::TryStreamExt;
use std::collections::HashSet;
use std::sync::Arc;

use crate::models::PgAuthDriver;

use super::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum GroupCommand {
    /// Create a group
    Create(CreateArgs),
    /// List groups
    List,
    /// Get a group's informations
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

pub async fn create_group(args: CreateArgs, pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let driver = PgAuthDriver::new(pool);
    let group_info = GroupInfo { name: args.name };
    let id = driver.ensure_group(&group_info).await?;
    tracing::info!(name = group_info.name, id, "Group created");
    println!("{id}");
    Ok(())
}

pub async fn list_group(pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let driver = PgAuthDriver::new(pool);
    let groups = driver.list_groups().await?.try_collect::<Vec<_>>().await?;
    if groups.is_empty() {
        tracing::info!("No group found.");
        return Ok(());
    }
    for (id, GroupInfo { name }) in &groups {
        println!("[{id}]: {name}");
    }
    Ok(())
}

pub async fn group_info(
    InfoArgs { name }: InfoArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let driver = regulator.driver();
    let Some(group_id) = driver.get_group_id(&name).await? else {
        tracing::error!(name, "No such group");
        return Ok(());
    };
    let Some(GroupInfo { name }) = driver.get_group_info(group_id).await? else {
        tracing::error!(group.id = group_id, "No such group");
        return Ok(());
    };
    let user_ids = regulator.group_members(&authz::Group(group_id)).await?;

    println!("id     : {group_id}");
    println!("name   : {name}");
    println!("members:");
    for authz::User(user_id) in user_ids {
        let Some(UserInfo { identity, name }) = driver.get_user_info(user_id).await? else {
            tracing::error!(user.id = user_id, "user not found, skipping it!");
            continue;
        };
        println!("- [{user_id}] {identity} ({name})");
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

    let Some(group_id) = driver.get_group_id(&group_name).await? else {
        bail!("No such group: '{group_name}'");
    };

    let mut authz_users = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            let uid = driver.get_user_id(user).await?;
            uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
        };
        authz_users.insert(authz::User(uid));
    }

    regulator
        .remove_members(&authz::Group(group_id), &authz_users)
        .await?;
    Ok(())
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

    let Some(group_id) = driver.get_group_id(&group_name).await? else {
        bail!("No such group: '{group_name}'");
    };

    let mut authz_users = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            let uid = driver.get_user_id(user).await?;
            uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
        };
        authz_users.insert(authz::User(uid));
    }

    regulator
        .add_members(&authz::Group(group_id), authz_users)
        .await?;
    Ok(())
}

pub async fn delete_group(
    DeleteArgs { name }: DeleteArgs,
    openfga_config: OpenfgaConfig,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let driver = regulator.driver();
    let group_id = if let Some(id) = driver.get_group_id(&name).await? {
        id
    } else {
        anyhow::bail!("group '{name}' could not be deleted (not found)");
    };
    let group = Group(group_id);

    // Delete the relationships between the group to be deleted and its members
    let users_in_group = regulator.group_members(&group).await?;
    regulator.remove_members(&group, &users_in_group).await?;

    let deleted = driver.delete_group(group_id).await?;
    if deleted {
        tracing::info!("group '{name}' deleted");
    } else {
        anyhow::bail!("group '{name}' could not be deleted (not found)");
    }

    Ok(())
}
