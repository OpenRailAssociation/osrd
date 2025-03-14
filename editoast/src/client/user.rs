use clap::Args;
use clap::Subcommand;
use editoast_authz::authorizer::StorageDriver;
use editoast_authz::authorizer::UserInfo;
use editoast_models::DbConnectionPoolV2;
use futures::future::try_join_all;
use futures::TryStreamExt;
use std::collections::HashSet;
use std::sync::Arc;

use crate::models::PgAuthDriver;

use super::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum UserCommand {
    /// List users
    List(ListArgs),
    /// Add a user
    Add(AddArgs),
}

#[derive(Debug, Args)]
pub struct ListArgs {
    /// Filter out users that are already in a group
    #[arg(long)]
    without_groups: bool,
}

#[derive(Debug, Args)]
pub struct AddArgs {
    /// Identity of the user
    identity: String,
    /// Name of the user
    name: Option<String>,
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
        let group_members = try_join_all(
            groups?
                .into_iter()
                .map(|(group_id, _)| regulator.group_members(group_id)),
        )
        .await?
        .into_iter()
        .flatten()
        .collect::<HashSet<_>>();
        users?
            .into_iter()
            .filter(|(user_id, _)| !group_members.contains(user_id))
            .collect::<Vec<_>>()
    } else {
        users?
    };

    for (id, UserInfo { identity, name }) in &users {
        println!("[{id}]: {identity} ({name})");
    }
    if users.is_empty() {
        tracing::info!("No user found");
    }
    Ok(())
}

/// Add a user
pub async fn add_user(args: AddArgs, pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let driver = PgAuthDriver::new(pool);

    let user_info = UserInfo {
        identity: args.identity,
        name: args.name.unwrap_or_default(),
    };
    let subject_id = driver.ensure_user(&user_info).await?;
    println!("User added with id: {}", subject_id);
    Ok(())
}
