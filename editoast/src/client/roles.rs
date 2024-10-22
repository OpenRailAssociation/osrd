use std::{collections::HashSet, fmt::Display, sync::Arc};

use anyhow::{anyhow, bail};
use clap::{Args, Subcommand};
use editoast_authz::{
    authorizer::{StorageDriver, UserInfo},
    roles::BuiltinRoleSet,
    BuiltinRole,
};
use editoast_models::DbConnectionPoolV2;
use itertools::Itertools as _;
use strum::IntoEnumIterator;
use tracing::info;

use crate::models::auth::PgAuthDriver;

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
    BuiltinRole::iter().for_each(|role| println!("{role}"));
}

#[derive(Debug)]
struct Subject {
    id: i64,
    info: UserInfo,
}

impl Display for Subject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Self {
            id,
            info: UserInfo { identity, name },
        } = self;
        write!(f, "{identity}#{id} ({name})")
    }
}

async fn parse_and_fetch_subject(
    subject: &String,
    driver: &PgAuthDriver<BuiltinRole>,
) -> anyhow::Result<Subject> {
    let id = if let Ok(id) = subject.parse::<i64>() {
        id
    } else {
        let uid = driver.get_user_id(subject).await?;
        uid.ok_or_else(|| anyhow!("No subject with identity '{subject}' found"))?
    };
    if let Some(info) = driver.get_user_info(id).await? {
        let subject = Subject { id, info };
        info!("Subject {subject}");
        Ok(subject)
    } else {
        bail!("No subject found with ID {id}");
    }
}

pub async fn list_subject_roles(
    ListArgs { subject }: ListArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let driver = PgAuthDriver::<BuiltinRole>::new(pool);
    let subject = parse_and_fetch_subject(&subject, &driver).await?;
    let roles = driver.fetch_subject_roles(subject.id).await?;
    if roles.is_empty() {
        info!("{subject} has no roles assigned");
        return Ok(());
    }
    for role in roles {
        println!("{role}");
    }
    Ok(())
}

fn parse_role_case_insensitive(tag: &str) -> anyhow::Result<BuiltinRole> {
    let tag = tag.to_lowercase();
    for role in BuiltinRole::iter() {
        if role.as_str().to_lowercase() == tag {
            return Ok(role);
        }
    }
    bail!("Invalid role tag '{tag}'");
}

pub async fn add_roles(
    AddArgs { subject, roles }: AddArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let driver = PgAuthDriver::<BuiltinRole>::new(pool);
    let subject = parse_and_fetch_subject(&subject, &driver).await?;
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
    driver.ensure_subject_roles(subject.id, roles).await?;
    Ok(())
}

pub async fn remove_roles(
    RemoveArgs { subject, roles }: RemoveArgs,
    pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let driver = PgAuthDriver::<BuiltinRole>::new(pool);
    let subject = parse_and_fetch_subject(&subject, &driver).await?;
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
    driver.remove_subject_roles(subject.id, roles).await?;
    Ok(())
}
