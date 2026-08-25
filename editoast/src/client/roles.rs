use std::collections::HashSet;
use std::fmt::Display;
use std::sync::Arc;

use anyhow::anyhow;
use anyhow::bail;
use authz;
use authz::Role;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use authz::v2::Authorizer;
use clap::Args;
use clap::Subcommand;
use database::DbConnection;
use database::DbConnectionPoolV2;
use itertools::Itertools as _;
use models::Group;
use models::prelude::*;
use strum::IntoEnumIterator;
use tracing::info;

use authz::SystemAuthorizer;

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

#[derive(Debug, Clone)]
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

    fn into_authz(self) -> authz::Subject {
        match self.info {
            SubjectInfo::User(_) => authz::Subject::User(authz::User(self.id)),
            SubjectInfo::Group(_) => authz::Subject::Group(authz::Group(self.id)),
        }
    }
}

#[derive(Debug, Clone)]
enum SubjectInfo {
    User(UserInfo),
    Group(GroupInfo),
}

impl Display for Subject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Self { id, info } = self;
        match info {
            SubjectInfo::User(UserInfo { name, identities }) => {
                write!(f, "User {name}#{id} ({})", identities.join(", "))
            }
            SubjectInfo::Group(info) => write!(f, "Group #{} ({})", id, info.name),
        }
    }
}

async fn parse_and_fetch_subject(subject: &String, conn: DbConnection) -> anyhow::Result<Subject> {
    let id = if let Ok(id) = subject.parse::<i64>() {
        id
    } else {
        models::User::retrieve_by_identity(subject, conn.clone())
            .await?
            .ok_or_else(|| anyhow!("No user with identity '{subject}' found"))?
            .id
    };
    let subject = if let Some(user) = models::User::retrieve(conn.clone(), id).await? {
        let identities = user.get_identities(conn.clone()).await?;
        Subject::new_user(
            id,
            UserInfo {
                name: user.name,
                identities,
            },
        )
    } else if let Some(group) = Group::retrieve(conn, id).await? {
        Subject::new_group(id, GroupInfo { name: group.name })
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
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let subject_roles = authz::v2::subject_roles(subject.clone().into_authz());
    let Ok(roles) = system.authorize(subject_roles).await?.access().await?;

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
    let expected: Vec<String> = Role::iter().map(|role| role.to_string()).collect();
    bail!("Invalid role tag '{tag}', expected one of {expected:?}");
}

pub async fn add_roles(
    AddArgs { subject, roles }: AddArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let openfga = &openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(openfga);

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
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let add_roles = authz::v2::add_roles(subject.into_authz(), roles);
    let Ok(()) = system.authorize(add_roles).await?.access().await?;
    Ok(())
}

pub async fn remove_roles(
    RemoveArgs { subject, roles }: RemoveArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let openfga = &openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(openfga);

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
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let remove_roles = authz::v2::remove_roles(subject.into_authz(), roles);
    let Ok(()) = system.authorize(remove_roles).await?.access().await?;
    Ok(())
}
