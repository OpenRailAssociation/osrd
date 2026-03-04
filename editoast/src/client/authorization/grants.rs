use std::collections::HashMap;
use std::sync::Arc;

use anyhow::bail;
use authz::Regulator;
use clap::Args;
use clap::Subcommand;
use clap::ValueEnum;
use editoast_models::PgAuthDriver;
use editoast_models::prelude::*;
use fga::client::Request;
use fga::model::Relation;
use tracing::info;

use database::DbConnectionPoolV2;
use tracing::warn;

use super::parse_and_fetch_subject;
use crate::client::authorization::RichSubject;
use crate::client::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum GrantsCommand {
    /// Set a grant on a resource for a subject
    Set(SetArgs),
    /// Unset a grant on a resource from a subject
    Unset(UnsetArgs),
    /// List all subjects with their grant level on a resource
    ListSubjects(ListSubjectsArgs),
    /// List all resources a subject has grants on
    ListResources(ListResourcesArgs),
}

#[derive(Debug, Clone, ValueEnum)]
pub enum Resource {
    Infra,
}

#[derive(Debug, Clone, ValueEnum)]
#[value(rename_all = "lower")]
pub enum InfraGrantArg {
    Reader,
    Writer,
    Owner,
}

impl From<InfraGrantArg> for authz::InfraGrant {
    fn from(level: InfraGrantArg) -> Self {
        match level {
            InfraGrantArg::Reader => authz::InfraGrant::Reader,
            InfraGrantArg::Writer => authz::InfraGrant::Writer,
            InfraGrantArg::Owner => authz::InfraGrant::Owner,
        }
    }
}

#[derive(Debug, Args)]
struct IdentifiedResource {
    r#type: Resource,
    resource_id: i64,
}

#[derive(Debug, Args)]
pub struct SetArgs {
    #[clap(flatten)]
    resource: IdentifiedResource,
    level: InfraGrantArg,
    subject: String,
}

#[derive(Debug, Args)]
pub struct UnsetArgs {
    #[clap(flatten)]
    resource: IdentifiedResource,
    subject: String,
}

#[derive(Debug, Args)]
pub struct ListSubjectsArgs {
    #[clap(flatten)]
    resource: IdentifiedResource,
}

#[derive(Debug, Args)]
pub struct ListResourcesArgs {
    resource: Resource,
    subject: String,
}

pub async fn set_grant(
    SetArgs {
        level,
        subject,
        resource:
            IdentifiedResource {
                r#type: resource,
                resource_id,
            },
    }: SetArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let subject = parse_and_fetch_subject(&subject, regulator.driver()).await?;
    let new_grant = authz::InfraGrant::from(level);

    match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);

            info!("Granting {new_grant} on Infra#{resource_id} to {subject}");
            regulator
                .give_infra_grant_unchecked(&subject.to_authz(), &infra, new_grant)
                .await?;

            warn_about_orphaned_infra(regulator, &infra).await?;
        }
    }

    Ok(())
}

pub async fn unset_grant(
    UnsetArgs {
        subject,
        resource:
            IdentifiedResource {
                r#type: resource,
                resource_id,
            },
    }: UnsetArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    let subject = parse_and_fetch_subject(&subject, regulator.driver()).await?;

    match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);

            info!("Unsetting grants on Infra#{resource_id} from {subject}");
            regulator
                .revoke_infra_grants_unchecked(&subject.to_authz(), &infra)
                .await?;

            warn_about_orphaned_infra(regulator, &infra).await?;
        }
    }

    Ok(())
}

async fn warn_about_orphaned_infra(
    regulator: Regulator<PgAuthDriver>,
    infra: &authz::Infra,
) -> anyhow::Result<()> {
    if regulator.get_infra_owners(infra).await?.is_empty() {
        warn!("Infra#{} has no owner", infra.0);
    }
    Ok(())
}

pub async fn list_subjects(
    ListSubjectsArgs {
        resource:
            IdentifiedResource {
                r#type: resource,
                resource_id,
            },
    }: ListSubjectsArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool).await?;
    match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);

            let (owners, writers, readers) = tokio::try_join!(
                regulator.get_infra_owners(&infra),
                regulator.get_infra_writers(&infra),
                regulator.get_infra_readers(&infra)
            )?;

            let mut grants: HashMap<&authz::Subject, authz::InfraGrant> = HashMap::new();
            for subject in &owners {
                grants.insert(subject, authz::InfraGrant::Owner);
            }
            for subject in &writers {
                grants.insert(subject, authz::InfraGrant::Writer);
            }
            for subject in &readers {
                grants.insert(subject, authz::InfraGrant::Reader);
            }

            if grants.is_empty() {
                info!("No grants found for Infra#{resource_id}");
            }
            for (subject, grant) in grants {
                let Some(subject) =
                    RichSubject::fetch_from_authz(subject, regulator.driver()).await?
                else {
                    info!("Subject {subject} from OpenFGA does not exist anymore");
                    continue;
                };
                println!("[{grant:<6}]: {subject}");
            }
        }
    }

    Ok(())
}

pub async fn list_resources(
    ListResourcesArgs { resource, subject }: ListResourcesArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let regulator = openfga_config.into_regulator(pool.clone()).await?;
    let subject = parse_and_fetch_subject(&subject, regulator.driver()).await?;

    match resource {
        Resource::Infra => match subject.to_authz() {
            authz::Subject::User(user) => {
                if regulator.is_admin(&user).await? {
                    info!("User {user} is an admin and has access to all infrastructures");
                    return Ok(());
                }
                let (readers, writers, owners) = tokio::try_join!(
                    authz::Infra::reader()
                        .query_objects(&user)
                        .fetch(regulator.openfga()),
                    authz::Infra::writer()
                        .query_objects(&user)
                        .fetch(regulator.openfga()),
                    authz::Infra::owner()
                        .query_objects(&user)
                        .fetch(regulator.openfga())
                )?;

                let mut grants = HashMap::new();
                for authz::Infra(infra) in readers {
                    grants.insert(infra, authz::InfraGrant::Reader);
                }
                for authz::Infra(infra) in writers {
                    grants.insert(infra, authz::InfraGrant::Writer);
                }
                for authz::Infra(infra) in owners {
                    grants.insert(infra, authz::InfraGrant::Owner);
                }

                let conn = pool.get().await?;
                for (infra, grant) in grants {
                    if let Some(crate::models::Infra { name, .. }) =
                        crate::models::Infra::retrieve(conn.clone(), infra).await?
                    {
                        println!("[{grant:<6}]: Infra#{infra}({name})");
                    } else {
                        warn!(infra, ?grant, "stale grant found");
                    }
                }
            }
            authz::Subject::Group(_) => {
                bail!("list-resources is only supported for users, not groups");
            }
        },
    }

    Ok(())
}
