use std::collections::HashSet;
use std::fmt::Display;
use std::sync::Arc;

use anyhow::anyhow;
use anyhow::bail;
use authz;
use authz::Role;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use itertools::Itertools as _;
use strum::IntoEnumIterator;
use tracing::info;

use crate::models::PgAuthDriver;

use super::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum RolesCommand {
    /// Lists the builtin roles supported by editoast
    ListRoles,
    /// Lists the roles assigned to a subject
    List(ListArgs),
    /// Grants builtin roles to a subject
    Add(AddArgs),
    /// Revokes builtin roles from a subject
    Remove(RemoveArgs),
}

#[derive(Debug, Args)]
pub struct ListArgs {
    /// A subject ID or user identity
    subject: String,
}

#[derive(Debug, Args)]
pub struct AddArgs {
    /// A subject ID or user identity
    subject: String,
    /// A non-empty list of builtin roles
    roles: Vec<String>,
}

#[derive(Debug, Args)]
pub struct RemoveArgs {
    /// A subject ID or user identity
    subject: String,
    /// A non-empty list of builtin roles
    roles: Vec<String>,
}

pub fn list_roles() {
    Role::iter().for_each(|role| println!("{role}"));
}

#[derive(Debug)]
struct Subject {
    id: i64,
    info: SubjectInfo,
}
impl Subject {
    /// Create a new subject representing a user
    pub fn new_user(id: i64, info: UserInfo) -> Self {
        Self {
            id,
            info: SubjectInfo::User(info),
        }
    }

    /// Create a new subject representing a group
    pub fn new_group(id: i64, info: GroupInfo) -> Self {
        Self {
            id,
            info: SubjectInfo::Group(info),
        }
    }
}

#[derive(Debug)]
enum SubjectInfo {
    User(UserInfo),
    Group(GroupInfo),
}

impl Display for Subject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Self { id, info } = self;
        match info {
            SubjectInfo::User(UserInfo { name, identity }) => {
                write!(f, "User {identity}#{id} ({name})")
            }
            SubjectInfo::Group(info) => write!(f, "Group #{} ({})", id, info.name),
        }
    }
}

async fn parse_and_fetch_subject(
    subject: &String,
    driver: &PgAuthDriver,
) -> anyhow::Result<Subject> {
    let id = if let Ok(id) = subject.parse::<i64>() {
        id
    } else {
        let uid = driver.get_user_id(subject).await?;
        uid.ok_or_else(|| anyhow!("No user with identity '{subject}' found"))?
    };
    let subject = if let Some(info) = driver.get_user_info(id).await? {
        Subject::new_user(id, info)
    } else if let Some(info) = driver.get_group_info(id).await? {
        Subject::new_group(id, info)
    } else {
        bail!("No subject found with ID {id}");
    };
    info!("{subject}");
    Ok(subject)
}

pub async fn list_subject_roles(
    ListArgs { subject }: ListArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let roles = match parse_and_fetch_subject(&subject, regulator.driver()).await? {
        Subject {
            id,
            info: SubjectInfo::User(_),
        } => regulator.user_roles(&authz::User(id)).await?,
        Subject {
            id,
            info: SubjectInfo::Group(_),
        } => regulator.group_roles(&authz::Group(id)).await?,
    };
    if roles.is_empty() {
        info!("{subject} has no roles assigned");
        return Ok(());
    }
    for role in roles {
        println!("{role}");
    }
    Ok(())
}

fn parse_role_case_insensitive(tag: &str) -> anyhow::Result<Role> {
    let tag = tag.to_lowercase();
    for role in Role::iter() {
        if role.as_str().to_lowercase() == tag {
            return Ok(role);
        }
    }
    bail!("Invalid role tag '{tag}'");
}

pub async fn add_roles(
    AddArgs { subject, roles }: AddArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let roles = roles
        .iter()
        .map(String::as_str)
        .map(parse_role_case_insensitive)
        .collect::<Result<HashSet<_>, _>>()?;
    info!(
        "Adding roles {} to {subject}",
        roles
            .iter()
            .map(|role| role.to_string())
            .collect_vec()
            .join(", "),
    );
    match parse_and_fetch_subject(&subject, regulator.driver()).await? {
        Subject {
            id,
            info: SubjectInfo::User(_),
        } => regulator.grant_user_roles(&authz::User(id), roles).await?,
        Subject {
            id,
            info: SubjectInfo::Group(_),
        } => {
            regulator
                .grant_group_roles(&authz::Group(id), roles)
                .await?
        }
    }
    Ok(())
}

pub async fn remove_roles(
    RemoveArgs { subject, roles }: RemoveArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let roles = roles
        .iter()
        .map(String::as_str)
        .map(parse_role_case_insensitive)
        .collect::<Result<HashSet<_>, _>>()?;
    info!(
        "Removing roles {} from {subject}",
        roles
            .iter()
            .map(|role| role.to_string())
            .collect_vec()
            .join(", "),
    );
    match parse_and_fetch_subject(&subject, regulator.driver()).await? {
        Subject {
            id,
            info: SubjectInfo::User(_),
        } => regulator.revoke_user_roles(&authz::User(id), roles).await?,
        Subject {
            id,
            info: SubjectInfo::Group(_),
        } => {
            regulator
                .revoke_group_roles(&authz::Group(id), roles)
                .await?
        }
    }
    Ok(())
}
