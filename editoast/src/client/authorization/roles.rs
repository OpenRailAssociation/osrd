use std::collections::HashSet;
use std::sync::Arc;

use anyhow::bail;
use authz;
use authz::Role;
use authz::v2::Authorizer;
use clap::Args;
use clap::Subcommand;
use database::DbConnectionPoolV2;
use itertools::Itertools as _;
use strum::IntoEnumIterator;
use tracing::info;

use crate::authorizers::SystemAuthorizer;
use crate::client::authorization::parse_and_fetch_subject;
use crate::client::openfga_config::OpenfgaConfig;

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

pub async fn list_subject_roles(
    ListArgs { subject }: ListArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let subject_roles = authz::v2::subject_roles(subject.to_authz());
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
    let add_roles = authz::v2::add_roles(subject.to_authz(), roles);
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
    let remove_roles = authz::v2::remove_roles(subject.to_authz(), roles);
    let Ok(()) = system.authorize(remove_roles).await?.access().await?;
    Ok(())
}
