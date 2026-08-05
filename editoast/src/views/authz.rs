use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use crate::authorizers::SystemAuthorizer;
use crate::error::Result;
use crate::views::authz::resources::Resource;
use crate::views::authz::resources::StandardGrant;
use crate::views::authz::resources::StandardPrivilege;
use ::authz;
use ::authz::InfraGrant;
use ::authz::InfraPrivilege;
use ::authz::Role;
use authz::RollingStockGrant;
use authz::RollingStockPrivilege;
use authz::v2;
use authz::v2::Actor;
use authz::v2::Authorizer;
use authz::v2::Check;
use axum::Extension;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Json;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::Group;
use editoast_models::Infra;
use editoast_models::RollingStock;
use editoast_models::User;
use editoast_models::authn::user::UserWithIdentities;
use editoast_models::prelude::*;
use futures::TryStreamExt;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
#[cfg(test)]
use strum::EnumIter;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AppState;
use super::AuthorizationError;
use super::AuthorizerError;

mod resources;

#[derive(Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Debug))]
enum SubjectType {
    User,
    Group,
}

#[derive(Display, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(test, derive(Debug, EnumIter))]
pub(in crate::views) enum ResourceType {
    Infra,
    RollingStock,
}

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "authz")]
enum AuthzError {
    #[error("Internal error")]
    #[editoast_error(status = 500, no_context)]
    Authorizer(AuthorizerError),
    #[error("Unknown resource {resource_id}")]
    #[editoast_error(status = 404)]
    UnknownResource { resource_id: i64 },
    #[error("Unknown subject {subject_id}")]
    #[editoast_error(status = 404)]
    UnknownSubject { subject_id: i64 },
    #[error("Unknown user id '{id}'")]
    #[editoast_error(status = 404)]
    UnknownUser { id: i64 },
    #[error("Unknown user identities '{}'", identities.iter().format(", "))]
    #[editoast_error(status = 404)]
    UnknownIdentities { identities: HashSet<String> },
    #[error("Authorization error")]
    #[editoast_error(forward)]
    Authz(#[from] AuthorizationError),

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

impl From<AuthorizerError> for AuthzError {
    fn from(err: AuthorizerError) -> Self {
        match err {
            AuthorizerError::UnknownResource(resource_id) => {
                AuthzError::UnknownResource { resource_id }
            }
            AuthorizerError::UnknownSubject(subject_id) => {
                AuthzError::UnknownSubject { subject_id }
            }
            err => AuthzError::Authorizer(err),
        }
    }
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct WhoamiResponse {
    id: i64,
    name: String,
    #[schema(value_type = Vec<Role>)]
    roles: HashSet<Role>,
}

#[editoast_derive::route]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "Get the info of the current user",
        body = inline(WhoamiResponse),
    ))
)]
pub(in crate::views) async fn whoami(
    Extension(authn_state): Extension<crate::authentication::State>,
    Extension(user): Extension<Option<editoast_models::User>>,
) -> Result<Json<WhoamiResponse>> {
    match authn_state {
        crate::authentication::State::Skip => Err(AuthorizationError::Unauthenticated)?,
        crate::authentication::State::Authenticated { roles, .. } => {
            let user = user.expect("the user was authenticated and should therefore exist");
            let roles = HashSet::from_iter(roles);
            Ok(Json(WhoamiResponse {
                id: user.id,
                name: user.name,
                roles,
            }))
        }
    }
}

#[editoast_derive::route]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "Get the groups of the current user",
        body = inline(Vec<Group>),
    ))
)]
pub(in crate::views) async fn user_groups(
    Extension(authn_state): Extension<crate::authentication::State>,
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
) -> Result<Json<Vec<Group>>> {
    let user = authn_state
        .regular_user()
        .ok_or(AuthorizationError::Unauthenticated)?;
    let authorizer = authn_state.authorizer(regulator.openfga());
    let user_groups = authz::v2::user_groups(user)
        .authorize(&authorizer)
        .await?
        .access()
        .await?
        .map_err(|_| AuthorizationError::Forbidden)?;

    let groups_id = user_groups.into_iter().map(|authz::Group(id)| id);
    let (result, missing_ids) =
        editoast_models::Group::retrieve_batch(&mut db_pool.get().await?, groups_id).await?;

    if !missing_ids.is_empty() {
        tracing::warn!(
            missing_count = missing_ids.len(),
            missing_groups_id = ?missing_ids,
            "Groups not found in database"
        );
    }

    Ok(Json(result))
}

#[derive(Deserialize, Clone, ToSchema)]
pub(in crate::views) struct UsersInfoRequest {
    #[serde(default)]
    ids: Vec<i64>,
    #[serde(default)]
    identities: Vec<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Debug, PartialEq, Eq))]
pub(in crate::views) struct UserInfo {
    id: i64,
    name: String,
    identities: Vec<String>,
    roles: HashSet<Role>,
    #[schema(inline)]
    groups: HashSet<Group>,
}

#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(UsersInfoRequest),
        description = "A list of user IDs and identities to get information on",
    ),
    responses((
        status = 200,
        description = "Get information on a list of users",
        body = inline(Vec<UserInfo>),
    ))
)]
pub(in crate::views) async fn users_info(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Json(UsersInfoRequest { ids, identities }): Json<UsersInfoRequest>,
) -> Result<Json<Vec<UserInfo>>> {
    let conn = db_pool.get().await?;
    let users = {
        let (mut u1, u2) = tokio::try_join!(
            UserWithIdentities::stream_by_id(conn.clone(), &ids)
                .await?
                .try_collect::<Vec<_>>(),
            UserWithIdentities::stream_by_identity(conn.clone(), &identities)
                .await?
                .try_collect::<Vec<_>>(),
        )?;
        u1.extend(u2);
        u1
    };

    {
        let found_ids = users
            .iter()
            .map(|user| user.user.id)
            .collect::<HashSet<_>>();
        if let Some(id) = ids.into_iter().find(|id| !found_ids.contains(id)) {
            return Err(AuthzError::UnknownUser { id }.into());
        }
    }

    // Check for missing requested identities
    {
        let identities = HashSet::from_iter(identities.iter());
        let found_identities = users
            .iter()
            .flat_map(|u| u.identities.iter())
            .collect::<HashSet<_>>();
        let missing_identities = identities
            .difference(&found_identities)
            .map(std::ops::Deref::deref)
            .cloned() // &&String
            .collect::<HashSet<_>>();
        if !missing_identities.is_empty() {
            return Err(AuthzError::UnknownIdentities {
                identities: missing_identities,
            }
            .into());
        }
    }

    // Fetch groups for each user
    let groups_prots = v2::Protected::from_iter(users.into_iter().map(|user| {
        let user_groups = v2::user_groups(authz::User(user.user.id));
        v2::Protected::value(user).zip(user_groups)
    }));
    let system = SystemAuthorizer::new_infallible(regulator.openfga());
    let Ok(user_groups) = system.authorize(groups_prots).await?.access().await?;

    // Find groups that really exist (OpenFGA can be out of sync sometimes)
    let group_by_id = {
        let group_ids = user_groups
            .iter()
            .flat_map(|(_, groups)| groups.iter().map(|g| **g))
            .collect_vec();
        let settings = SelectionSettings::new().filter(move || Group::ID.eq_any(group_ids.clone()));
        let groups = Group::list(&mut db_pool.get().await?, settings).await?;
        Arc::new(
            groups
                .into_iter()
                .map(|g| (g.id, g))
                .collect::<HashMap<_, _>>(),
        )
    };

    // Fetch roles and build the response
    let Ok(results) = v2::Protected::from_iter(user_groups.into_iter().map(
        |(
            UserWithIdentities {
                user: editoast_models::User { id, name },
                identities,
            },
            groups,
        )| {
            let group_by_id = group_by_id.clone();
            v2::subject_roles(authz::Subject::user(id)).map(async move |roles| {
                UserInfo {
                    id,
                    name,
                    identities,
                    roles: HashSet::from_iter(roles),
                    groups: groups
                        .into_iter()
                        // Skip group if it does not exist
                        .filter_map(|g| group_by_id.get(&*g).cloned())
                        .collect(),
                }
            })
        },
    ))
    .authorize(&system)
    .await?
    .access()
    .await?;

    Ok(Json(results))
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq, Eq))]
pub(in crate::views) struct ResourcePrivileges {
    resource_id: i64,
    privileges: HashSet<StandardPrivilege>,
}

#[editoast_derive::route]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(HashMap<ResourceType, Vec<i64>>),
        description = "The resources of which to get the request sender's privileges.",
    ),
    responses((
        status = 200,
        description = "The privileges of the user sending the request over each requested resource. \
        The resource is omitted if it does not exist. \
        An empty privileges list is returned if the user has no privileges over it.",
        body = inline(HashMap<ResourceType, Vec<ResourcePrivileges>>)
    )),
)]
pub(in crate::views) async fn user_privileges(
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Json(resources_ids): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<ResourcePrivileges>>>> {
    let mut result = HashMap::<_, Vec<_>>::new();
    let missing_resources = retrieve_missing_resource_ids(
        db_pool.get().await?,
        resources_ids.iter().flat_map(|(resource_type, ids)| {
            std::iter::repeat(*resource_type).zip(ids.iter().copied())
        }),
    )
    .await?;

    match &authn_state {
        crate::authentication::State::Authenticated { user, .. } => {
            let resources = resources_ids.into_iter().flat_map(|(resource_type, ids)| {
                let missing_ids = &missing_resources[&resource_type];
                // Missing resources are not an error under this API: omit them before authorization.
                ids.into_iter()
                    .filter(|id| !missing_ids.contains(id))
                    .map(move |id| match resource_type {
                        ResourceType::Infra => Resource::Infra(authz::Infra(id)),
                        ResourceType::RollingStock => {
                            Resource::RollingStock(authz::RollingStock(id))
                        }
                    })
            });
            let protected_privileges = resources.into_iter().map(|resource| match resource {
                resource @ Resource::Infra(infra) => v2::infra_privileges(*user, infra)
                    .collect_into::<HashSet<StandardPrivilege>>()
                    .zip(v2::Protected::value(resource)),
                resource @ Resource::RollingStock(rolling_stock) => {
                    v2::rolling_stock_privileges(*user, rolling_stock)
                        .collect_into::<HashSet<StandardPrivilege>>()
                        .zip(v2::Protected::value(resource))
                }
            });
            let authorizer = authn_state.authorizer(regulator.openfga());
            let accesses = authorizer.authorize_all(protected_privileges).await?;
            for access in v2::Access::access_all(accesses).await? {
                match access {
                    Ok((privileges, resource)) => {
                        result
                            .entry(resource.get_type())
                            .or_default()
                            .push(ResourcePrivileges {
                                resource_id: resource.id(),
                                privileges,
                            });
                    }
                    Err(Check::HasInfraPrivilege(
                        Actor::Issuer,
                        InfraPrivilege::CanRestrictedRead,
                        infra,
                    )) => {
                        result
                            .entry(ResourceType::Infra)
                            .or_default()
                            .push(ResourcePrivileges {
                                resource_id: *infra,
                                privileges: HashSet::new(),
                            });
                    }
                    Err(Check::HasRollingStockPrivilege(
                        Actor::Issuer,
                        RollingStockPrivilege::CanRead,
                        rolling_stock,
                    )) => {
                        result.entry(ResourceType::RollingStock).or_default().push(
                            ResourcePrivileges {
                                resource_id: *rolling_stock,
                                privileges: HashSet::new(),
                            },
                        );
                    }
                    Err(_) => return Err(AuthorizationError::Forbidden.into()),
                }
            }
        }
        crate::authentication::State::Skip => {
            let privileges = HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ]);
            for (resource_type, ids) in resources_ids {
                let missing_ids = &missing_resources[&resource_type];
                result.entry(resource_type).or_default().extend(
                    ids.into_iter()
                        .filter(|id| !missing_ids.contains(id))
                        .map(|resource_id| ResourcePrivileges {
                            resource_id,
                            privileges: privileges.clone(),
                        }),
                );
            }
        }
    }
    Ok(Json(result))
}

async fn retrieve_missing_resource_ids(
    mut conn: database::DbConnection,
    resources: impl IntoIterator<Item = (ResourceType, i64)>,
) -> std::result::Result<HashMap<ResourceType, HashSet<i64>>, editoast_models::Error> {
    let mut resources = resources
        .into_iter()
        .into_group_map()
        .into_iter()
        .map(|(resource_type, ids)| (resource_type, ids.into_iter().collect()))
        .collect::<HashMap<ResourceType, HashSet<i64>>>();
    let infra_ids = resources.remove(&ResourceType::Infra).unwrap_or_default();
    let rolling_stock_ids = resources
        .remove(&ResourceType::RollingStock)
        .unwrap_or_default();

    let mut infra_conn = conn.clone();
    let ((_, missing_infras), (_, missing_rolling_stocks)) = tokio::try_join!(
        Infra::retrieve_batch::<_, Vec<_>>(&mut infra_conn, infra_ids),
        RollingStock::retrieve_batch::<_, Vec<_>>(&mut conn, rolling_stock_ids),
    )?;

    Ok(HashMap::from([
        (ResourceType::Infra, missing_infras),
        (ResourceType::RollingStock, missing_rolling_stocks),
    ]))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct UserResourceGrant {
    id: i64,
    grant: StandardGrant,
}

#[editoast_derive::route]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(HashMap<ResourceType, Vec<i64>>),
        description = "HashMap of resource type with a list of resource id to get the grants for. If a resource doesn't exist, it will be omitted.",
    ),
    responses((
        status = 200,
        description = "Get grants info of the current user for the given resources in body",
        body = inline(HashMap<ResourceType, Vec<UserResourceGrant>>)
    )),
)]
pub(in crate::views) async fn user_grants(
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Json(body): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<UserResourceGrant>>>> {
    let user = authn_state
        .regular_user()
        .ok_or(AuthorizationError::Unauthenticated)?;
    let authorizer = authn_state.authorizer(regulator.openfga());
    let mut response = HashMap::<_, Vec<UserResourceGrant>>::new();
    let missing_resources = retrieve_missing_resource_ids(
        db_pool.get().await?,
        body.iter().flat_map(|(resource_type, ids)| {
            std::iter::repeat(*resource_type).zip(ids.iter().copied())
        }),
    )
    .await?;
    // Missing resources are not an error under this API: omit them before authorization.
    // TODO build all protected at once, zip them and batch send them with `authorize_all`
    for (resource_type, ids) in &body {
        for id in ids {
            if missing_resources[resource_type].contains(id) {
                continue;
            }
            let grant_access = match resource_type {
                ResourceType::Infra => {
                    authz::v2::infra_effective_grant(authz::Subject::user(user), authz::Infra(*id))
                        .map_some_into::<StandardGrant>()
                }

                ResourceType::RollingStock => authz::v2::rolling_stock_effective_grant(
                    authz::Subject::user(user),
                    authz::RollingStock(*id),
                )
                .map_some_into::<StandardGrant>(),
            }
            .authorize(&authorizer)
            .await?
            .access()
            .await?;
            let grant = match grant_access {
                Ok(Some(grant)) => grant,
                Ok(None) => continue,
                Err(Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanRead, infra)) => {
                    tracing::warn!(%infra, "user cannot read infra — skipping");
                    continue;
                }
                Err(Check::HasRollingStockPrivilege(
                    Actor::Issuer,
                    RollingStockPrivilege::CanRead,
                    rolling_stock,
                )) => {
                    tracing::warn!(%rolling_stock, "user cannot read rolling stock — skipping");
                    continue;
                }
                Err(_) => return Err(AuthorizationError::Forbidden.into()),
            };
            response
                .entry(*resource_type)
                .or_default()
                .push(UserResourceGrant { id: *id, grant });
        }
    }

    Ok(Json(response))
}

#[derive(Deserialize, IntoParams)]
pub(in crate::views) struct ResourceTypeParam {
    resource_type: ResourceType,
}

#[derive(Deserialize, IntoParams)]
pub(in crate::views) struct ResourceIdParam {
    resource_id: i64,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
pub(in crate::views) struct SubjectGrant {
    id: i64,
    name: String,
    r#type: SubjectType,
    grant: StandardGrant,
}

#[editoast_derive::route]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    params(ResourceTypeParam, ResourceIdParam),
    responses(
        (status = 200, description = "Get list of user that have a grant on the resource", body = inline(Vec<SubjectGrant>)),
    ),
)]
pub(in crate::views) async fn resource_granted_users(
    Extension(authn_state): Extension<crate::authentication::State>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
    Path(ResourceIdParam { resource_id }): Path<ResourceIdParam>,
) -> Result<Json<Vec<SubjectGrant>>> {
    let mut conn = db_pool.get().await?;
    let openfga = regulator.openfga();
    let authorizer = authn_state.authorizer(openfga);
    // Ask OpenFGA about grants on the resource
    let ((readers, writers), owners) = match resource_type {
        ResourceType::Infra => {
            let infra = authz::Infra(resource_id);
            Infra::exists_or_fail(&mut conn, resource_id, || AuthzError::UnknownResource {
                resource_id,
            })
            .await?;
            authorizer
                .authorize(
                    authz::v2::infra_granted_subjects(infra, InfraGrant::Reader)
                        .zip(authz::v2::infra_granted_subjects(infra, InfraGrant::Writer))
                        .zip(authz::v2::infra_granted_subjects(infra, InfraGrant::Owner)),
                )
                .await?
                .access()
                .await?
                .map_err(|_| AuthorizationError::Forbidden)?
        }
        ResourceType::RollingStock => {
            let rolling_stock = authz::RollingStock(resource_id);
            RollingStock::exists_or_fail(&mut conn, resource_id, || AuthzError::UnknownResource {
                resource_id,
            })
            .await?;
            authorizer
                .authorize(
                    authz::v2::rolling_stock_granted_subjects(
                        rolling_stock,
                        RollingStockGrant::Reader,
                    )
                    .zip(authz::v2::rolling_stock_granted_subjects(
                        rolling_stock,
                        RollingStockGrant::Writer,
                    ))
                    .zip(authz::v2::rolling_stock_granted_subjects(
                        rolling_stock,
                        RollingStockGrant::Owner,
                    )),
                )
                .await?
                .access()
                .await?
                .map_err(|_| AuthorizationError::Forbidden)?
        }
    };

    // NOTE: the same subject can appear in multiple lists. This can happen
    // if a user inherits a grant from one of its groups and also has a direct grant.
    // Implicit grants are not the same thing as privileges: they are not the same object,
    // are not represented by the same enum, do no work on the same scale or in the same way.
    // The deduplication happens in the map collection below, but the order of the chaining
    // is important to ensure the higher grant is kept in case of duplicates (last item wins).
    let mut subjects_grant = readers
        .into_iter()
        .map(|s| (s, InfraGrant::Reader))
        .chain(writers.into_iter().map(|s| (s, InfraGrant::Writer)))
        .chain(owners.into_iter().map(|s| (s, InfraGrant::Owner)))
        .map(|(subject, grant)| match subject {
            authz::Subject::User(authz::User(id)) => (id, grant),
            authz::Subject::Group(authz::Group(id)) => (id, grant),
        })
        .collect::<HashMap<_, _>>();

    if subjects_grant.is_empty() {
        // No point querying the database if there are no subjects with grants.
        return Ok(Json(vec![]));
    }

    let subjects_id = subjects_grant.keys().copied().collect_vec();

    // Query subject details from the database
    let (mut users, mut groups) = db_pool
        .get()
        .await?
        .transaction::<_, crate::error::InternalError, _, _>(async |mut conn| {
            let users = {
                let subjects_id = subjects_id.clone();
                User::list(
                    &mut conn,
                    SelectionSettings::new().filter(move || User::ID.eq_any(subjects_id.clone())),
                )
                .await?
                .into_iter()
                .map(|u| (u.id, u.name))
                .collect::<HashMap<_, _>>()
            };

            let groups = {
                let subjects_id = subjects_id.clone();
                Group::list(
                    &mut conn,
                    SelectionSettings::new().filter(move || Group::ID.eq_any(subjects_id.clone())),
                )
                .await?
                .into_iter()
                .map(|g| (g.id, g.name))
                .collect::<HashMap<_, _>>()
            };

            Ok((users, groups))
        })
        .await?;

    // We have everything we need to build the response.
    let subjects_grant = subjects_id
        .into_iter()
        .filter_map(|id| {
            let subject = users
                .remove(&id)
                .map(|name| (name, SubjectType::User))
                .or_else(|| groups.remove(&id).map(|name| (name, SubjectType::Group)));
            let Some((name, r#type)) = subject else {
                // OpenFGA may return subjects that don't exist anymore, skip them
                return None;
            };
            let grant = subjects_grant
                .remove(&id)
                .expect("subjects_id is a subset of subjects_grant keys by construction")
                .into();
            Some(SubjectGrant {
                id,
                name,
                r#type,
                grant,
            })
        })
        .collect_vec();

    Ok(Json(subjects_grant))
}

#[derive(Deserialize, ToSchema)]
pub(in crate::views) struct GrantBody {
    resource_type: ResourceType,
    resource_id: i64,
    subject_id: i64,
    grant: StandardGrant,
}

#[derive(Deserialize, ToSchema)]
pub(in crate::views) struct RevokeBody {
    resource_type: ResourceType,
    resource_id: i64,
    subject_id: i64,
}

/// `grant` XOR `revoke` is expected
#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(in crate::views) enum BodyUpdateGrants {
    Grant(Vec<GrantBody>),
    Revoke(Vec<RevokeBody>),
}

#[editoast_derive::route]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(BodyUpdateGrants),
        description = "List of new authorization to add or to remove (i.e. grants a resource to a person)",
    ),
    responses(
        (status = 201, description = "Successful granting"),
        (status = 204, description = "Successful revoking"),
    ),
)]
pub(in crate::views) async fn update_grants(
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Json(body): Json<BodyUpdateGrants>,
) -> Result<impl IntoResponse> {
    {
        let conn = db_pool.get().await?;
        let missing_resources = match &body {
            BodyUpdateGrants::Grant(grants) => {
                retrieve_missing_resource_ids(
                    conn,
                    grants
                        .iter()
                        .map(|grant| (grant.resource_type, grant.resource_id)),
                )
                .await?
            }
            BodyUpdateGrants::Revoke(revokes) => {
                retrieve_missing_resource_ids(
                    conn,
                    revokes
                        .iter()
                        .map(|revoke| (revoke.resource_type, revoke.resource_id)),
                )
                .await?
            }
        };
        let missing_resource_id = [ResourceType::Infra, ResourceType::RollingStock]
            .into_iter()
            .find_map(|resource_type| missing_resources[&resource_type].iter().min().copied());
        if let Some(resource_id) = missing_resource_id {
            return Err(AuthzError::UnknownResource { resource_id }.into());
        }
    }

    // Fetch subjects from the database and determine whether they're a user or a group.
    let subjects = {
        let subjects_id = match &body {
            BodyUpdateGrants::Grant(grants) => grants.iter().map(|g| g.subject_id).collect_vec(),
            BodyUpdateGrants::Revoke(revoke) => revoke.iter().map(|r| r.subject_id).collect_vec(),
        };
        let mut conn = db_pool.get().await?;
        let mut conn2 = conn.clone();
        let (users, groups) = tokio::try_join!(
            editoast_models::User::list(
                &mut conn,
                SelectionSettings::new().filter({
                    let ids = subjects_id.clone();
                    move || editoast_models::User::ID.eq_any(ids.clone())
                })
            ),
            editoast_models::Group::list(
                &mut conn2,
                SelectionSettings::new()
                    .filter(move || editoast_models::Group::ID.eq_any(subjects_id.clone()))
            )
        )?;
        users
            .into_iter()
            .map(|editoast_models::User { id, .. }| (id, authz::Subject::User(authz::User(id))))
            .chain(groups.into_iter().map(|editoast_models::Group { id, .. }| {
                (id, authz::Subject::Group(authz::Group(id)))
            }))
            .collect::<HashMap<_, _>>()
    };

    let authorizer = authn_state.authorizer(regulator.openfga());

    match body {
        BodyUpdateGrants::Grant(grants) => {
            let prot = grants
                .into_iter()
                .map(|g| g.into_protected(&subjects))
                .process_results(|iter| authz::v2::Protected::from_iter(iter))?;

            match prot.authorize(&authorizer).await?.access().await? {
                Ok(_) => Ok(StatusCode::CREATED),
                Err(_) => Err(AuthorizationError::Forbidden.into()),
            }
        }
        BodyUpdateGrants::Revoke(revokes) => {
            let prot = revokes
                .into_iter()
                .map(|r| r.into_protected(&subjects))
                .process_results(|iter| authz::v2::Protected::from_iter(iter))?;

            match prot.authorize(&authorizer).await?.access().await? {
                Ok(_) => Ok(StatusCode::NO_CONTENT),
                Err(_) => Err(AuthorizationError::Forbidden.into()),
            }
        }
    }
}

impl GrantBody {
    fn into_protected(
        self,
        subjects: &HashMap<i64, authz::Subject>,
    ) -> Result<authz::v2::Protected<()>, AuthzError> {
        let Self {
            resource_type,
            resource_id,
            subject_id,
            grant,
        } = self;
        let subject = subjects
            .get(&subject_id)
            .ok_or_else(|| AuthzError::UnknownSubject { subject_id })?;
        Ok(match resource_type {
            ResourceType::Infra => {
                authz::v2::infra_set_grant(*subject, resource_id.into(), grant.into())
            }
            ResourceType::RollingStock => {
                authz::v2::rolling_stock_set_grant(*subject, resource_id.into(), grant.into())
            }
        })
    }
}

impl RevokeBody {
    fn into_protected(
        self,
        subjects: &HashMap<i64, authz::Subject>,
    ) -> Result<authz::v2::Protected<bool>, AuthzError> {
        let Self {
            resource_type,
            resource_id,
            subject_id,
        } = self;
        let subject = subjects
            .get(&subject_id)
            .ok_or_else(|| AuthzError::UnknownSubject { subject_id })?;
        Ok(match resource_type {
            ResourceType::Infra => authz::v2::infra_revoke_grant(*subject, resource_id.into()),
            ResourceType::RollingStock => {
                authz::v2::rolling_stock_revoke_grant(*subject, resource_id.into())
            }
        })
    }
}

#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "List all the groups",
        body = inline(Vec<Group>),
    ))
)]
pub(in crate::views) async fn list_groups(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<Json<Vec<Group>>> {
    let mut groups = Group::list(&mut db_pool.get().await?, SelectionSettings::new()).await?;

    groups.sort_by_key(|g| g.id);

    Ok(Json(groups))
}

#[cfg(test)]
mod tests {
    use authz::RollingStockGrant;
    use authz::v2::TestClientExt as _;
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::collections::HashSet;
    use strum::IntoEnumIterator;

    use super::*;
    use crate::error::InternalError;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_fast_rolling_stock;
    use crate::fixtures::create_small_infra;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges() {
        let app = test_app!().build();
        let Infra { id: infra1, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra2, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra3, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra4, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra {
            id: infra_unused, ..
        } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let toto = app
            .user("toto", "Toto")
            .with_infra_grant(infra1, InfraGrant::Owner)
            .with_infra_grant(infra2, InfraGrant::Writer)
            .with_infra_grant(infra3, InfraGrant::Reader)
            .create()
            .await;

        let mut privileges = app
            .post("/authz/me/privileges")
            .by_user(toto.as_ref())
            .json(&json!({
               "infra": [infra1, infra2, infra3, infra4, i64::MAX]
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            privileges.remove(&infra1).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );
        assert_eq!(
            privileges.remove(&infra2).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
            ])
        );
        assert_eq!(
            privileges.remove(&infra3).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead
            ])
        );
        assert_eq!(privileges.remove(&infra4).unwrap(), HashSet::from([]));
        assert!(!privileges.contains_key(&infra_unused));
        assert!(!privileges.contains_key(&i64::MAX));
    }

    // TODO: merge with the previous test once test deadlocks are fixed
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_bis() {
        let app = test_app!().build();
        let Infra { id: infra1, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra2, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra3, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra4, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra {
            id: infra_unused, ..
        } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let tata = app
            .user("tata", "Tata")
            .with_infra_grant(infra1, InfraGrant::Reader)
            .with_infra_grant(infra3, InfraGrant::Reader)
            .with_infra_grant(infra4, InfraGrant::Owner)
            .create()
            .await;

        let mut privileges = app
            .post("/authz/me/privileges")
            .by_user(tata.as_ref())
            .json(&json!({
               "infra": [infra1, infra2, infra3, infra4]
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            privileges.remove(&infra1).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead
            ])
        );
        assert_eq!(privileges.remove(&infra2).unwrap(), HashSet::from([]));
        assert_eq!(
            privileges.remove(&infra3).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
            ])
        );
        assert_eq!(
            privileges.remove(&infra4).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );
        assert!(!privileges.contains_key(&infra_unused));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_skip_authz() {
        let app = test_app!().build();
        let Infra { id: infra, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let mut privileges = app
            .post("/authz/me/privileges")
            .skip_authz()
            .json(&json!({
               "infra": [infra]
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            privileges.remove(&infra).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_me_grants() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let rs_with_grant = create_fast_rolling_stock(&mut db_pool.get_ok(), "rs_with_grant").await;
        let rs_no_grant = create_fast_rolling_stock(&mut db_pool.get_ok(), "rs_no_grant").await;
        let infra_no_grant = create_small_infra(&mut db_pool.get_ok()).await;

        let user = app
            .user("test", "Test")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .with_rolling_stock_grant(rs_with_grant.id, RollingStockGrant::Reader)
            .create()
            .await;

        // Ask the grant of the user for the resources
        let response: HashMap<ResourceType, Vec<UserResourceGrant>> = app
            .post("/authz/me/grants")
            .by_user(user.as_ref())
            .json(&json!({
                "infra": [infra.id],
                "rolling_stock": [rs_with_grant.id],
            }))
            .await
            .assert_status_ok()
            .json();

        // Check the direct grants are there
        assert_eq!(
            response.get(&ResourceType::Infra).unwrap(),
            &[UserResourceGrant {
                id: infra.id,
                grant: StandardGrant::Reader
            }]
        );
        assert_eq!(
            response.get(&ResourceType::RollingStock).unwrap(),
            &[UserResourceGrant {
                id: rs_with_grant.id,
                grant: StandardGrant::Reader
            }]
        );

        app.group("Group")
            .with_members([&user])
            .with_infra_grant(infra.id, InfraGrant::Writer)
            .with_rolling_stock_grant(rs_with_grant.id, RollingStockGrant::Writer)
            .create()
            .await;

        // Ask the grant of the user for the resources again
        let response: HashMap<ResourceType, Vec<UserResourceGrant>> = app
            .post("/authz/me/grants")
            .by_user(user.as_ref())
            .json(&json!({
                "infra": [infra.id, infra_no_grant.id, infra_no_grant.id + 1000],
                "rolling_stock": [rs_with_grant.id, rs_no_grant.id, rs_no_grant.id + 1000],
            }))
            .await
            .assert_status_ok()
            .json();

        // Check the inherited grant from the group has overridden by the user's direct grant
        // Unreadable and non-existent resources are filtered out
        assert_eq!(
            response.get(&ResourceType::Infra).unwrap(),
            &[UserResourceGrant {
                id: infra.id,
                grant: StandardGrant::Writer
            }]
        );
        assert_eq!(
            response.get(&ResourceType::RollingStock).unwrap(),
            &[UserResourceGrant {
                id: rs_with_grant.id,
                grant: StandardGrant::Writer
            }]
        );
    }

    // TODO rewrite the test and check which users have grants on which resources.
    // Currently the test only checks the number of users with a grant on the resources, which is a
    // weak assertion.
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn users_grants_for_resource_id_test() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .with_rolling_stock_grant(infra.id, RollingStockGrant::Owner)
            .create()
            .await;
        let rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), "rolling_stock").await;
        for name in ["ben", "hal", "joe", "luc", "mar"] {
            app.user(name, name)
                .with_roles([Role::OperationalStudies])
                .with_infra_grant(infra.id, InfraGrant::Reader)
                .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
                .create()
                .await;
        }
        // Temporary fix: add a few users so that the number of users with reader grant are not the
        // same for the infra and the rolling stock.
        for name in ["tim", "tom"] {
            app.user(name, name)
                .with_roles([Role::OperationalStudies])
                .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
                .create()
                .await;
        }
        for resource_type in ResourceType::iter() {
            let subjects: Vec<SubjectGrant> = app
                .get(&format!("/authz/{}/{}", resource_type, infra.id))
                .by_user(user.as_ref())
                .await
                .assert_status(StatusCode::OK)
                .json();
            match resource_type {
                ResourceType::Infra => {
                    assert_eq!(subjects.len(), 6);
                }
                ResourceType::RollingStock => {
                    assert_eq!(subjects.len(), 8);
                }
            }
        }
    }

    #[rstest]
    #[case(ResourceType::Infra)]
    #[case(ResourceType::RollingStock)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn users_grants_for_missing_resource_returns_not_found(
        #[case] resource_type: ResourceType,
    ) {
        let app = test_app!().build();
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.get(&format!("/authz/{resource_type}/{}", i64::MAX))
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[rstest]
    #[case(ResourceType::Infra)]
    #[case(ResourceType::RollingStock)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_grants_for_missing_resource_returns_not_found(
        #[case] resource_type: ResourceType,
    ) {
        let app = test_app!().build();
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let subject = app.user("subject", "Subject").create().await;

        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [{
                    "subject_id": subject.id,
                    "resource_type": resource_type,
                    "resource_id": i64::MAX,
                    "grant": StandardGrant::Reader,
                }]
            }))
            .await
            .assert_status_not_found();

        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "revoke": [{
                    "subject_id": subject.id,
                    "resource_type": resource_type,
                    "resource_id": i64::MAX,
                }]
            }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_grants_reports_missing_resources_deterministically() {
        let app = test_app!().build();
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let subject = app.user("subject", "Subject").create().await;
        let missing_infra_id = i64::MAX - 1;

        let response: InternalError = app
            .post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": subject.id,
                        "resource_type": ResourceType::RollingStock,
                        "resource_id": i64::MAX,
                        "grant": StandardGrant::Reader,
                    },
                    {
                        "subject_id": subject.id,
                        "resource_type": ResourceType::Infra,
                        "resource_id": missing_infra_id,
                        "grant": StandardGrant::Reader,
                    },
                ]
            }))
            .await
            .assert_status_not_found()
            .json();

        assert_eq!(
            response.context["resource_id"],
            serde_json::Value::from(missing_infra_id)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn groups_grants_on_resource() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), "rolling_stock").await;
        let alice = app
            .user("alice", "Alice")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
            .create()
            .await;
        let bob = app
            .user("bob", "Bob")
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Owner)
            .create()
            .await;
        let tom = app
            .user("tom", "Tom")
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Owner)
            .create()
            .await;
        let jerry = app
            .user("jerry", "Jerry")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Reader)
            .create()
            .await;
        let alice_and_bob = app
            .group("Alice and Bob")
            .with_members([&alice, &bob])
            .with_infra_grant(infra.id, InfraGrant::Writer)
            .with_rolling_stock_grant(rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;
        let tom_and_jerry = app
            .group("Tom and Jerry")
            .with_members([&tom, &jerry])
            .create()
            .await;
        for resource_type in ResourceType::iter() {
            let resource_id = match resource_type {
                ResourceType::Infra => infra.id,
                ResourceType::RollingStock => rolling_stock.id,
            };
            let subjects: Vec<SubjectGrant> = app
                .get(&format!("/authz/{}/{}", resource_type, resource_id))
                .by_user(alice.as_ref())
                .await
                .assert_status(StatusCode::OK)
                .json();

            let grants = subjects
                .into_iter()
                .map(|SubjectGrant { id, grant, .. }| (id, grant))
                .collect::<HashMap<_, _>>();

            assert_eq!(grants.get(&alice.id), Some(&StandardGrant::Writer)); // group grants can supersede direct user grants
            assert_eq!(grants.get(&bob.id), Some(&StandardGrant::Owner)); // but do not override them
            assert_eq!(grants.get(&tom.id), Some(&StandardGrant::Owner)); // direct user grant
            assert_eq!(grants.get(&jerry.id), Some(&StandardGrant::Reader)); // likewise
            assert_eq!(grants.get(&alice_and_bob.id), Some(&StandardGrant::Writer)); // group direct grant
            assert_eq!(grants.get(&tom_and_jerry.id), None); // no group grant (not even there in the response)
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await
        )]
    #[case::rolling_stock(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await
        )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn grants_test(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        // This test starts with a user that is the owner of resource.
        // Then it creates a new user and adds it as a writer to the resource.
        // Finally, it removes the new user from the resource.
        let openfga = app.openfga();

        // Create a new user and add it as a writer to the resource with the grant API
        let writer = authz::User::from(app.user("writer", "Writer").create().await);
        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": *writer,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Writer
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        // Check that the new user has the good grant
        match resource_type {
            ResourceType::Infra => assert_eq!(
                openfga
                    .infra_direct_grant(authz::Subject::user(writer), authz::Infra(resource_id))
                    .await,
                Some(InfraGrant::Writer)
            ),
            ResourceType::RollingStock => assert_eq!(
                openfga
                    .rolling_stock_direct_grant(
                        authz::Subject::user(writer),
                        authz::RollingStock(resource_id)
                    )
                    .await,
                Some(RollingStockGrant::Writer)
            ),
        }

        // Remove the user grant from the API
        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": *writer,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    }
                ]
            }))
            .await
            .assert_status_no_content();

        match resource_type {
            ResourceType::Infra => assert_eq!(
                openfga
                    .infra_direct_grant(authz::Subject::user(writer), authz::Infra(resource_id))
                    .await,
                None
            ),
            ResourceType::RollingStock => assert_eq!(
                openfga
                    .rolling_stock_direct_grant(
                        authz::Subject::user(writer),
                        authz::RollingStock(resource_id)
                    )
                    .await,
                None
            ),
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("reader", "Reader")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("reader", "Reader")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn only_owners_can_revoke_grants(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] reader: authz::identity::User,
        #[case] writer: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .by_user(writer.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": reader.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    },
                ]
            }))
            .await
            .assert_status_forbidden();

        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, reader.id, Some(InfraGrant::Reader))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    reader.id,
                    Some(RollingStockGrant::Reader),
                )
                .await
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("reader", "Reader")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("reader", "Reader")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn admins_can_revoke_grants(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] reader: authz::identity::User,
    ) {
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        app.post("/authz/grants")
            .by_user(admin.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": reader.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    },
                ]
            }))
            .await
            .assert_status_no_content();

        match resource_type {
            ResourceType::Infra => app.assert_infra_grant(resource_id, reader.id, None),
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, reader.id, None)
                    .await
            }
        };
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn last_resource_owner_can_be_revoked_by_admin(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        app.post("/authz/grants")
            .by_user(admin.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": owner.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    },
                ]
            }))
            .await
            .assert_status_no_content();

        match resource_type {
            ResourceType::Infra => app.assert_infra_grant(resource_id, owner.id, None),
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, owner.id, None)
                    .await
            }
        };
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("alice", "Alice")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
        app
            .user("bob", "Bob")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("alice", "Alice")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
        app
            .user("bob", "Bob")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn owner_cannot_revoke_another_resource_owner(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] alice: authz::identity::User,
        #[case] bob: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .by_user(alice.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": bob.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    }
                ]
            }))
            .await
            .assert_status_forbidden();

        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, bob.id, Some(InfraGrant::Owner))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, bob.id, Some(RollingStockGrant::Owner))
                    .await
            }
        };
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn admin_can_demote_last_resource_owner(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": owner.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(admin.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, owner.id, Some(InfraGrant::Writer));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    owner.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("alice", "Alice")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
        app
            .user("bob", "Bob")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("alice", "Alice")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
        app
            .user("bob", "Bob")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn admin_can_promote_and_demote_anyone_resource_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] alice: authz::identity::User,
        #[case] bob: authz::identity::User,
    ) {
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": bob.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Owner
                }]
            }))
            .by_user(admin.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, bob.id, Some(InfraGrant::Owner))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, bob.id, Some(RollingStockGrant::Owner))
                    .await
            }
        }

        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": bob.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(admin.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, alice.id, Some(InfraGrant::Owner));
                app.assert_infra_grant(resource_id, bob.id, Some(InfraGrant::Writer));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    alice.id,
                    Some(RollingStockGrant::Owner),
                )
                .await;
                app.assert_rolling_stock_grant(
                    resource_id,
                    bob.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn last_owner_cannot_demote_itself(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": owner.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(owner.as_ref())
            .await
            .assert_status_forbidden();
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, owner.id, Some(InfraGrant::Owner))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    owner.id,
                    Some(RollingStockGrant::Owner),
                )
                .await
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("tom", "Tom")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
        app
            .user("jerry", "Jerry")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("tom", "Tom")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
        app
            .user("jerry", "Jerry")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn owner_cannot_demote_another_owner(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] tom: authz::identity::User,
        #[case] jerry: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": jerry.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(tom.as_ref())
            .await
            .assert_status_forbidden();
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, jerry.id, Some(InfraGrant::Owner))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    jerry.id,
                    Some(RollingStockGrant::Owner),
                )
                .await
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
        app
            .user("target", "Target")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
        app
            .user("target", "Target")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn owner_can_promote_and_demote_anyone_infra_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
        #[case] target: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": target.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(owner.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, target.id, Some(InfraGrant::Writer));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    target.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
            }
        }

        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": target.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Reader
                }]
            }))
            .by_user(owner.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, target.id, Some(InfraGrant::Reader));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    target.id,
                    Some(RollingStockGrant::Reader),
                )
                .await
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn writer_can_demote_self_resource_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] writer: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": writer.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Reader
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, writer.id, Some(InfraGrant::Reader));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    writer.id,
                    Some(RollingStockGrant::Reader),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn writer_cannot_promote_self_resource_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] writer: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": writer.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Owner
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status_forbidden();
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, writer.id, Some(InfraGrant::Writer));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    writer.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
        app
            .user("reader", "Reader")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
        app
            .user("reader", "Reader")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn writer_can_promote_another_subject_up_to_writer_infra_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] writer: authz::identity::User,
        #[case] reader: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": reader.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status(StatusCode::CREATED);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, reader.id, Some(InfraGrant::Writer));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    reader.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
        app
            .user("reader", "Reader")
            .with_infra_grant(resource_id, InfraGrant::Reader)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
        app
            .user("reader", "Reader")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Reader)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn writer_cannot_promote_above_writer_rolling_stock_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] writer: authz::identity::User,
        #[case] reader: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": reader.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Owner
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status_forbidden();
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, reader.id, Some(InfraGrant::Reader));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    reader.id,
                    Some(RollingStockGrant::Reader),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("writer", "Writer")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
        app
            .user("equal", "Equal")
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
        app
            .user("higher", "Higher")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("writer", "Writer")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
        app
            .user("equal", "Equal")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
        app
            .user("higher", "Higher")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn writer_cannot_demote_equal_or_higher_infra_grant_target(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] writer: authz::identity::User,
        #[case] equal: authz::identity::User,
        #[case] higher: authz::identity::User,
    ) {
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": equal.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Reader
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status_forbidden();
        app.post("/authz/grants")
            .json(&json!({
                "grant": [{
                    "subject_id": higher.id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "grant": StandardGrant::Writer
                }]
            }))
            .by_user(writer.as_ref())
            .await
            .assert_status_forbidden();

        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, writer.id, Some(InfraGrant::Writer));
                app.assert_infra_grant(resource_id, equal.id, Some(InfraGrant::Writer));
                app.assert_infra_grant(resource_id, higher.id, Some(InfraGrant::Owner));
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(
                    resource_id,
                    writer.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
                app.assert_rolling_stock_grant(
                    resource_id,
                    equal.id,
                    Some(RollingStockGrant::Writer),
                )
                .await;
                app.assert_rolling_stock_grant(
                    resource_id,
                    higher.id,
                    Some(RollingStockGrant::Owner),
                )
                .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("alice", "Alice")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("alice", "Alice")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn admin_can_give_grants_to_groups(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] alice: authz::identity::User,
    ) {
        let openfga = app.openfga();
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        let bob = app.user("bob", "Bob").create().await;
        let alice_and_bob = app
            .group("Alice and Bob")
            .with_members([&alice, &bob])
            .create()
            .await;
        let alice_info = alice.clone();
        let alice = authz::User::from(alice);
        let bob = authz::User::from(bob);
        let alice_and_bob = authz::Group::from(alice_and_bob);

        app.post("/authz/grants")
            .by_user(admin.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": *alice_and_bob,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Writer
                    },
                    {
                        "subject_id": *bob,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Reader
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        match resource_type {
            ResourceType::Infra => {
                let infra = authz::Infra(resource_id);
                assert_eq!(
                    openfga.infra_direct_grant(alice, infra).await,
                    Some(InfraGrant::Owner)
                ); // still owner
                assert_eq!(
                    openfga.infra_direct_grant(alice_and_bob, infra).await,
                    Some(InfraGrant::Writer)
                ); // direct group grant
                assert_eq!(
                    openfga.infra_direct_grant(bob, infra).await,
                    Some(InfraGrant::Reader)
                ); // direct user grant
                app.assert_infra_grant(resource_id, *bob, Some(InfraGrant::Writer)); // inherited group grant
                app.assert_infra_grant(resource_id, *alice, Some(InfraGrant::Owner)); // inherited group grant superseded by direct user grant
            }
            ResourceType::RollingStock => {
                let rolling_stock = authz::RollingStock(resource_id);
                assert_eq!(
                    openfga
                        .rolling_stock_direct_grant(authz::Subject::user(alice), rolling_stock)
                        .await,
                    Some(RollingStockGrant::Owner)
                ); // still owner
                assert_eq!(
                    openfga
                        .rolling_stock_direct_grant(
                            authz::Subject::group(alice_and_bob),
                            rolling_stock
                        )
                        .await,
                    Some(RollingStockGrant::Writer)
                ); // direct group grant
                assert_eq!(
                    openfga
                        .rolling_stock_direct_grant(authz::Subject::user(bob), rolling_stock)
                        .await,
                    Some(RollingStockGrant::Reader)
                ); // direct user grant
                app.assert_rolling_stock_grant(resource_id, *bob, Some(RollingStockGrant::Writer))
                    .await; // inherited group grant
                app.assert_rolling_stock_grant(resource_id, *alice, Some(RollingStockGrant::Owner))
                    .await; // inherited group grant superseded by direct user grant
            }
        }

        app.post("/authz/grants")
            .by_user(alice_info.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": *alice_and_bob,
                        "resource_type": resource_type,
                        "resource_id": resource_id
                    }
                ]
            }))
            .await
            .assert_status_no_content();

        match resource_type {
            ResourceType::Infra => {
                let infra = authz::Infra(resource_id);
                assert_eq!(openfga.infra_direct_grant(alice_and_bob, infra).await, None); // group grant removed
                assert_eq!(
                    openfga.infra_direct_grant(bob, infra).await,
                    Some(InfraGrant::Reader)
                ); // bob's direct grant is still there
            }
            ResourceType::RollingStock => {
                let rolling_stock = authz::RollingStock(resource_id);
                assert_eq!(
                    openfga
                        .rolling_stock_direct_grant(
                            authz::Subject::group(alice_and_bob),
                            rolling_stock
                        )
                        .await,
                    None
                ); // group grant removed
                assert_eq!(
                    openfga
                        .rolling_stock_direct_grant(authz::Subject::user(bob), rolling_stock)
                        .await,
                    Some(RollingStockGrant::Reader)
                ); // bob's direct grant is still there
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn non_admin_forbidden_to_give_groups_any_grant(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        let bob = app.user("bob", "Bob").create().await;
        let group = app.group("Group").with_members([&bob]).create().await;

        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": group.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Reader
                    }
                ]
            }))
            .await
            .assert_status_forbidden();

        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, bob.id, None);
                app.assert_infra_grant(resource_id, group.id, None);
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, bob.id, None)
                    .await;
                app.assert_rolling_stock_grant(resource_id, group.id, None)
                    .await;
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
        app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
        app
            .user("spike", "Spike")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(resource_id, InfraGrant::Writer)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
        app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
        app
            .user("spike", "Spike")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Writer)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn adding_a_grant_that_already_exists(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
        #[case] writer: authz::identity::User,
        #[case] other_writer: authz::identity::User,
    ) {
        // owner self-reassigns their own grant
        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": owner.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Owner
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        // owner can reassign writer's grant
        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": writer.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Writer
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        // writer can reassign their own grant
        app.post("/authz/grants")
            .by_user(writer.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": writer.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Writer
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        // writer can reassign another writer's grant if it is a no-op
        app.post("/authz/grants")
            .by_user(writer.as_ref())
            .json(&json!({
                "grant": [
                    {
                        "subject_id": other_writer.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Writer
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn skipped_authz_can_set_grants(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
    ) {
        let user = authz::User::from(app.user("user", "User").create().await);
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, user.0, None);
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, user.0, None)
                    .await;
            }
        }
        app.post("/authz/grants")
            .skip_authz()
            .json(&json!({
                "grant": [
                    {
                        "subject_id": *user,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "grant": StandardGrant::Owner
                    }
                ]
            }))
            .await
            .assert_status(StatusCode::CREATED);

        match resource_type {
            ResourceType::Infra => {
                assert_eq!(
                    app.openfga()
                        .infra_direct_grant(user, authz::Infra(resource_id))
                        .await,
                    Some(InfraGrant::Owner)
                );
            }
            ResourceType::RollingStock => {
                assert_eq!(
                    app.openfga()
                        .rolling_stock_direct_grant(
                            authz::Subject::User(user),
                            authz::RollingStock(resource_id)
                        )
                        .await,
                    Some(RollingStockGrant::Owner)
                );
            }
        }
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        authz::User::from(
            app.user("user", "User")
                .with_infra_grant(resource_id, InfraGrant::Owner)
                .create()
                .await,
        ),
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        authz::User::from(
            app.user("user", "User")
                .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
                .create()
                .await,
        ),

    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn skipped_authz_can_remove_grants(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] user: authz::User,
    ) {
        match resource_type {
            ResourceType::Infra => {
                app.assert_infra_grant(resource_id, user.0, Some(InfraGrant::Owner))
            }
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, user.0, Some(RollingStockGrant::Owner))
                    .await
            }
        };
        app.post("/authz/grants")
            .skip_authz()
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": *user,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                    },
                ]
            }))
            .await
            .assert_status_no_content();

        match resource_type {
            ResourceType::Infra => app.assert_infra_grant(resource_id, user.0, None),
            ResourceType::RollingStock => {
                app.assert_rolling_stock_grant(resource_id, user.0, None)
                    .await
            }
        };
    }

    #[rstest]
    #[case::infra(
        test_app!().build(),
        create_small_infra(&mut app.db_pool().get_ok()).await.id,
        ResourceType::Infra,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(resource_id, InfraGrant::Owner)
            .create()
            .await,
    )]
    #[case::rolling_stock(
        test_app!().build(),
        create_fast_rolling_stock(&mut app.db_pool().get_ok(), "rolling_stock").await.id,
        ResourceType::RollingStock,
        app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(resource_id, RollingStockGrant::Owner)
            .create()
            .await,
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn remove_a_grant_that_doesnt_exist(
        #[case] app: TestApp,
        #[case] resource_id: i64,
        #[case] resource_type: ResourceType,
        #[case] owner: authz::identity::User,
    ) {
        let other = app.user("other", "Other").create().await;
        app.post("/authz/grants")
            .by_user(owner.as_ref())
            .json(&json!({
                "revoke": [
                    {
                        "subject_id": other.id,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                    },
                ]
            }))
            .await
            .assert_status_no_content();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_test() {
        let app = test_app!().build();
        let user = app
            .user("test", "test")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let user_data = app
            .get("/authz/me")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: user.id,
                name: "test".to_string(),
                roles: HashSet::from([Role::OperationalStudies]),
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_impersonation() {
        let app = test_app!().build();
        let impersonator = app
            .user("impersonator", "Impersonator")
            .with_roles([Role::Admin])
            .create()
            .await;
        let impersonated = app
            .user("impersonated", "Impersonated")
            .with_roles([Role::Stdcm])
            .create()
            .await;

        let user_data = app
            .get("/authz/me")
            .by_user(impersonator.as_ref())
            .impersonate(impersonated.as_ref())
            .await
            .assert_status_ok()
            .json::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: impersonated.id,
                name: "Impersonated".to_string(),
                roles: HashSet::from([Role::Stdcm]),
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_new_impersonator_always_forbidden() {
        let app = test_app!().build();
        let impersonated = app
            .user("impersonated", "Impersonated")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let identity = "Who's there?".to_owned();

        app.get("/authz/me")
            .by_user(&authz::identity::UserInfo {
                identities: vec![identity.clone()],
                name: "No one.".to_owned(),
            })
            .impersonate(impersonated.as_ref())
            .await
            .assert_status_forbidden();

        assert_eq!(
            editoast_models::User::retrieve_by_identity(&identity, app.db_pool().get_ok()).await,
            Ok(None),
            "new user should not be registered"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn users_info() {
        let app = test_app!().build();
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        let user_1 = app
            .user("user_1", "User 1")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let user_2 = app
            .user("user_2", "User 2")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let group_1 = app
            .group("group_1")
            .with_members([&user_1, &user_2])
            .create()
            .await;
        let group_2 = app.group("group_2").with_members([&user_2]).create().await;

        let mut users_info = app
            .post("/authz/user/info")
            .by_user(admin.as_ref())
            .json(&json!({
                "ids": [user_1.id],
                "identities": [user_2.info.identities[0].clone()],
            }))
            .await
            .assert_status_ok()
            .json::<Vec<UserInfo>>();

        users_info.sort_by_key(|user| user.id);

        assert_eq!(
            users_info,
            vec![
                UserInfo {
                    id: user_1.id,
                    name: user_1.info.name,
                    identities: user_1.info.identities,
                    roles: HashSet::from([Role::OperationalStudies]),
                    groups: HashSet::from([Group {
                        id: group_1.id,
                        name: group_1.info.name.clone(),
                    }]),
                },
                UserInfo {
                    id: user_2.id,
                    name: user_2.info.name,
                    identities: user_2.info.identities,
                    roles: HashSet::from([Role::Stdcm]),
                    groups: HashSet::from([
                        Group {
                            id: group_1.id,
                            name: group_1.info.name,
                        },
                        Group {
                            id: group_2.id,
                            name: group_2.info.name,
                        },
                    ]),
                },
            ]
        );

        app.post("/authz/user/info")
            .by_user(admin.as_ref())
            .json(&json!({ "ids": [i64::MAX] }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_groups_test() {
        let app = test_app!().build();
        let user_1 = app.user("test1", "test1").create().await;
        let user_2 = app.user("test2", "test2").create().await;
        let group_1 = app
            .group("group_1")
            .with_members([&user_1, &user_2])
            .create()
            .await;
        let group_2 = app.group("group_2").with_members([&user_1]).create().await;

        let mut groups_user_1 = app
            .get("/authz/me/groups")
            .by_user(user_1.as_ref())
            .await
            .assert_status_ok()
            .json::<Vec<Group>>();
        let groups_user_2 = app
            .get("/authz/me/groups")
            .by_user(user_2.as_ref())
            .await
            .assert_status_ok()
            .json::<Vec<Group>>();

        groups_user_1.sort_by_key(|g| g.id);

        assert_eq!(
            groups_user_1,
            vec![
                Group {
                    id: group_1.id,
                    name: "group_1".to_string(),
                },
                Group {
                    id: group_2.id,
                    name: "group_2".to_string(),
                }
            ]
        );
        assert_eq!(
            groups_user_2,
            vec![Group {
                id: group_1.id,
                name: "group_1".to_string(),
            }]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_groups_skip_authz() {
        let app = test_app!().build();

        // Without a user in the request
        app.get("/authz/me/groups")
            .skip_authz()
            .await
            .assert_status_unauthorized();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_groups_test() {
        let app = test_app!().build();

        // Create an admin user
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        // Create some groups
        let group_1 = app.group("G1").create().await;
        let group_2 = app.group("G2").create().await;
        let group_3 = app.group("G3").create().await;

        // List all groups as admin
        let groups = app
            .get("/authz/groups")
            .by_user(admin.as_ref())
            .await
            .assert_status_ok()
            .json::<Vec<Group>>();

        // Verify all groups are returned
        assert_eq!(groups.len(), 3);
        assert!(groups[0].id == group_1.id && groups[0].name == "G1");
        assert!(groups[1].id == group_2.id && groups[1].name == "G2");
        assert!(groups[2].id == group_3.id && groups[2].name == "G3");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_groups_forbidden_non_admin() {
        let app = test_app!().build();

        // Create a non-admin user
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Try to list groups as non-admin
        app.get("/authz/groups")
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }
}
