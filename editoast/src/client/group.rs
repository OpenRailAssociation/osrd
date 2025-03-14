use anyhow::anyhow;
use anyhow::bail;
use clap::Args;
use clap::Subcommand;

use editoast_authz::subject::GroupInfo;
use editoast_authz::StorageDriver;

use editoast_models::DbConnectionPoolV2;
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
    /// Add members to a group
    Include(IncludeArgs),
    /// Remove members to a group
    Exclude(ExcludeArgs),
}

#[derive(Debug, Args)]
pub struct CreateArgs {
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
        println!("[{}]: {}", id, name);
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

    let mut user_ids = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            let uid = driver.get_user_id(user).await?;
            uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
        };
        user_ids.insert(uid);
    }

    regulator.remove_members(group_id, user_ids).await?;
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

    let mut user_ids = HashSet::new();
    for user in &users {
        let uid = if let Ok(id) = user.parse::<i64>() {
            id
        } else {
            let uid = driver.get_user_id(user).await?;
            uid.ok_or_else(|| anyhow!("No user with identity '{user}' found"))?
        };
        user_ids.insert(uid);
    }

    regulator.add_members(group_id, user_ids).await?;
    Ok(())
}
