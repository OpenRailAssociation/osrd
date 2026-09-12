use std::collections::HashMap;
use std::sync::Arc;

use anyhow::bail;
use authz::v2::Authorizer as _;
use authz::v2::Protected;
use authz::v2::ResourcesList;
use clap::Args;
use clap::Subcommand;
use clap::ValueEnum;
use database::DbConnectionPoolV2;
use models::prelude::*;
use tracing::info;
use tracing::warn;

use super::RichSubject;
use super::parse_and_fetch_subject;
use crate::authorizers::SystemAuthorizer;
use crate::client::openfga_config::OpenfgaConfig;

#[derive(Debug, Subcommand)]
pub enum GrantsCommand {
    /// Set a grant on a resource for a subject
    Set(SetArgs),
    /// Unset a grant on a resource from a subject
    Unset(UnsetArgs),
    /// List all subjects with their **effective** grant level on a resource
    ListSubjects(ListSubjectsArgs),
    /// List all resources a subject has grants on
    ListResources(ListResourcesArgs),
}

#[derive(Debug, Clone, Copy, ValueEnum, derive_more::Display)]
pub enum Resource {
    Infra,
    RollingStock,
    Project,
}

#[derive(Debug, Clone, Copy, ValueEnum, derive_more::Display)]
#[value(rename_all = "snake_case")]
#[display(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CliGrant {
    RestrictedReader,
    Reader,
    Writer,
    Owner,
}

impl From<CliGrant> for authz::InfraGrant {
    fn from(level: CliGrant) -> Self {
        match level {
            CliGrant::RestrictedReader => Self::RestrictedReader,
            CliGrant::Reader => Self::Reader,
            CliGrant::Writer => Self::Writer,
            CliGrant::Owner => Self::Owner,
        }
    }
}

impl From<CliGrant> for authz::RollingStockGrant {
    fn from(level: CliGrant) -> Self {
        match level {
            CliGrant::RestrictedReader => Self::RestrictedReader,
            CliGrant::Reader => Self::Reader,
            CliGrant::Writer => Self::Writer,
            CliGrant::Owner => Self::Owner,
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
    level: CliGrant,
    /// A subject ID or user identity
    subject: String,
}

#[derive(Debug, Args)]
pub struct UnsetArgs {
    #[clap(flatten)]
    resource: IdentifiedResource,
    /// A subject ID or user identity
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
    /// A user ID or identity
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
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let authz_subject = subject.to_authz();
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);

    match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);
            let grant = authz::InfraGrant::from(level);
            info!("Granting {grant} on Infra#{resource_id} to {subject}");
            let Ok(()) = system
                .authorize(authz::v2::infra_set_grant(authz_subject, infra, grant))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Owner),
                "Infra",
                resource_id,
            )
            .await?;
        }
        Resource::RollingStock => {
            let rolling_stock = authz::RollingStock(resource_id);
            let grant = authz::RollingStockGrant::from(level);
            info!("Granting {grant} on RollingStock#{resource_id} to {subject}");
            let Ok(()) = system
                .authorize(authz::v2::rolling_stock_set_grant(
                    authz_subject,
                    rolling_stock,
                    grant,
                ))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::Owner,
                ),
                "RollingStock",
                resource_id,
            )
            .await?;
        }
        Resource::Project => {
            if !matches!(level, CliGrant::Owner) {
                bail!("Projects only support the owner grant");
            }
            let project = authz::Project(resource_id);
            info!("Granting OWNER on Project#{resource_id} to {subject}");
            let Ok(()) = system
                .authorize(authz::v2::project_set_grant(authz_subject, project))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::project_granted_subjects(project, authz::ProjectGrant::Owner),
                "Project",
                resource_id,
            )
            .await?;
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
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let authz_subject = subject.to_authz();
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);

    match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);
            info!("Unsetting grants on Infra#{resource_id} from {subject}");
            let Ok(_) = system
                .authorize(authz::v2::infra_revoke_grant(authz_subject, infra))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Owner),
                "Infra",
                resource_id,
            )
            .await?;
        }
        Resource::RollingStock => {
            let rolling_stock = authz::RollingStock(resource_id);
            info!("Unsetting grants on RollingStock#{resource_id} from {subject}");
            let Ok(_) = system
                .authorize(authz::v2::rolling_stock_revoke_grant(
                    authz_subject,
                    rolling_stock,
                ))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::Owner,
                ),
                "RollingStock",
                resource_id,
            )
            .await?;
        }
        Resource::Project => {
            let project = authz::Project(resource_id);
            info!("Unsetting grants on Project#{resource_id} from {subject}");
            let Ok(_) = system
                .authorize(authz::v2::project_revoke_grant(authz_subject, project))
                .await?
                .access()
                .await?;
            warn_about_orphaned(
                &system,
                authz::v2::project_granted_subjects(project, authz::ProjectGrant::Owner),
                "Project",
                resource_id,
            )
            .await?;
        }
    }

    Ok(())
}

async fn warn_about_orphaned(
    system: &SystemAuthorizer<'_>,
    owners: Protected<Vec<authz::Subject>>,
    resource_name: &'static str,
    resource_id: i64,
) -> anyhow::Result<()> {
    let Ok(owners) = system.authorize(owners).await?.access().await?;
    if owners.is_empty() {
        warn!("{resource_name}#{resource_id} has no owner");
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
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);
    let conn = pool.get().await?;

    let protected = match resource {
        Resource::Infra => {
            let infra = authz::Infra(resource_id);
            Protected::from_iter([
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::RestrictedReader)
                    .zip(Protected::value(CliGrant::RestrictedReader)),
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Reader)
                    .zip(Protected::value(CliGrant::Reader)),
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Writer)
                    .zip(Protected::value(CliGrant::Writer)),
                authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Owner)
                    .zip(Protected::value(CliGrant::Owner)),
            ])
        }
        Resource::RollingStock => {
            let rolling_stock = authz::RollingStock(resource_id);
            Protected::from_iter([
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::RestrictedReader,
                )
                .zip(Protected::value(CliGrant::RestrictedReader)),
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::Reader,
                )
                .zip(Protected::value(CliGrant::Reader)),
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::Writer,
                )
                .zip(Protected::value(CliGrant::Writer)),
                authz::v2::rolling_stock_granted_subjects(
                    rolling_stock,
                    authz::RollingStockGrant::Owner,
                )
                .zip(Protected::value(CliGrant::Owner)),
            ])
        }
        Resource::Project => {
            let project = authz::Project(resource_id);
            Protected::from_iter([authz::v2::project_granted_subjects(
                project,
                authz::ProjectGrant::Owner,
            )
            .zip(Protected::value(CliGrant::Owner))])
        }
    };
    let Ok(granted_subjects) = system.authorize(protected).await?.access().await?;
    let grants = granted_subjects
        .into_iter()
        .flat_map(|(subjects, grant)| subjects.into_iter().map(move |subject| (subject, grant)))
        .collect::<HashMap<_, _>>();
    if grants.is_empty() {
        info!("No grants found for {resource}#{resource_id}");
    }
    for (subject, grant) in grants {
        let authz_subject = subject;
        let Some(subject) = RichSubject::fetch_from_authz(subject, conn.clone()).await? else {
            info!("Subject {authz_subject} from OpenFGA does not exist anymore");
            continue;
        };
        println!("[{:>17}]: {subject}", grant.to_string());
    }

    Ok(())
}

pub async fn list_resources(
    ListResourcesArgs { resource, subject }: ListResourcesArgs,
    pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let subject = parse_and_fetch_subject(&subject, pool.get().await?).await?;
    let authz::Subject::User(user) = subject.to_authz() else {
        bail!("list-resources is only supported for users, not groups");
    };
    let openfga = openfga_config.into_client().await?;
    let system = SystemAuthorizer::new_infallible(&openfga);
    let conn = pool.get().await?;

    match resource {
        Resource::Infra => {
            let Ok(resources) = system
                .authorize(authz::v2::infra_list(
                    user,
                    authz::InfraPrivilege::CanRestrictedRead,
                ))
                .await?
                .access()
                .await?;
            match resources {
                ResourcesList::All => {
                    info!("{user} is an admin and has access to all infrastructures");
                }
                ResourcesList::Privileged(resources) if resources.is_empty() => {
                    info!("{user} does not have access to any infrastructure");
                }
                ResourcesList::Privileged(resources) => {
                    for infra in resources {
                        let Ok(Some(grant)) = system
                            .authorize(authz::v2::infra_effective_grant(
                                authz::Subject::User(user),
                                infra,
                            ))
                            .await?
                            .access()
                            .await?
                        else {
                            continue;
                        };
                        if let Some(models::Infra { name, .. }) =
                            models::Infra::retrieve(conn.clone(), *infra).await?
                        {
                            println!("[{:>17}]: Infra#{}({name})", grant, *infra);
                        } else {
                            warn!(infra = *infra, ?grant, "stale grant found");
                        }
                    }
                }
            }
        }
        Resource::RollingStock => {
            let Ok(resources) = system
                .authorize(authz::v2::rolling_stock_list(
                    user,
                    authz::RollingStockPrivilege::CanRestrictedRead,
                ))
                .await?
                .access()
                .await?;
            match resources {
                ResourcesList::All => {
                    info!("{user} is an admin and has access to all rolling stocks");
                }
                ResourcesList::Privileged(resources) if resources.is_empty() => {
                    info!("{user} does not have access to any rolling stock");
                }
                ResourcesList::Privileged(resources) => {
                    for rolling_stock in resources {
                        let Ok(Some(grant)) = system
                            .authorize(authz::v2::rolling_stock_effective_grant(
                                authz::Subject::User(user),
                                rolling_stock,
                            ))
                            .await?
                            .access()
                            .await?
                        else {
                            continue;
                        };
                        if let Some(models::RollingStock { name, .. }) =
                            models::RollingStock::retrieve(conn.clone(), *rolling_stock).await?
                        {
                            println!("[{:>17}]: RollingStock#{}({name})", grant, *rolling_stock);
                        } else {
                            warn!(rolling_stock = *rolling_stock, ?grant, "stale grant found");
                        }
                    }
                }
            }
        }
        Resource::Project => {
            let Ok(resources) = system
                .authorize(authz::v2::project_list(user))
                .await?
                .access()
                .await?;
            match resources {
                ResourcesList::All => {
                    info!("{user} is an admin and has access to all projects");
                }
                ResourcesList::Privileged(resources) if resources.is_empty() => {
                    info!("{user} does not have access to any project");
                }
                ResourcesList::Privileged(resources) => {
                    for project in resources {
                        let Ok(Some(_)) = system
                            .authorize(authz::v2::project_effective_grant(
                                authz::Subject::User(user),
                                project,
                            ))
                            .await?
                            .access()
                            .await?
                        else {
                            continue;
                        };
                        let grant = CliGrant::Owner;
                        if let Some(models::Project { name, .. }) =
                            models::Project::retrieve(conn.clone(), *project).await?
                        {
                            println!("[{:>17}]: Project#{}({name})", grant, *project);
                        } else {
                            warn!(project = *project, ?grant, "stale grant found");
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
