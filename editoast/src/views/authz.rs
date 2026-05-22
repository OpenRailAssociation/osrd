use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use crate::authorizers::UserAuthorizer;
use crate::authorizers::impossible;
use crate::error::Result;
use crate::views::Authentication;
use ::authz;
use ::authz::InfraGrant;
use ::authz::InfraPrivilege;
use ::authz::Role;
use authz::Authorization;
use authz::v2;
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
use editoast_models::User;
use editoast_models::prelude::*;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;
use super::AuthorizerError;

#[derive(Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Debug))]
enum SubjectType {
    User,
    Group,
}

#[derive(Display, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(test, derive(Debug))]
pub(in crate::views) enum ResourceType {
    Infra,
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
    #[error("Unknown user identity '{identity}'")]
    #[editoast_error(status = 404)]
    UnknownIdentity { identity: String },
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
    roles: Vec<Role>,
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
    Extension(auth): AuthenticationExt,
) -> Result<Json<WhoamiResponse>> {
    Ok(Json(WhoamiResponse {
        // TODO: don't return -1 and a hardcoded name, return a different schema instead, requires frontend changes
        id: auth.user_id()?.unwrap_or(-1),
        name: auth.user_name()?.unwrap_or_else(|| "OSRD user".to_string()),
        roles: auth.user_roles().await?.into_iter().collect(),
    }))
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
    Extension(auth): AuthenticationExt,
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
) -> Result<Json<Vec<Group>>> {
    let authorizer = auth.authorizer()?;
    let user_id = authorizer.user_id();
    let user_groups = regulator.user_groups(&authz::User(user_id)).await?;
    let groups_id: Vec<i64> = user_groups.iter().map(|authz::Group(id)| *id).collect();

    let (result, missing_ids) =
        editoast_models::Group::retrieve_batch(&mut db_pool.get().await?, groups_id).await?;

    if !missing_ids.is_empty() {
        tracing::warn!(missing_count = missing_ids.len(),
            missing_groups_id = ?missing_ids,
             "Groups not found in database");
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
    Json(body): Json<UsersInfoRequest>,
) -> Result<Json<Vec<UserInfo>>> {
    let UsersInfoRequest { ids: user_ids, .. } = body.clone();

    // Retrieve users by IDs
    let users_1: Vec<_> =
        User::retrieve_batch_or_fail(&mut db_pool.get().await?, user_ids, |missing| {
            AuthzError::UnknownUser {
                id: *missing.iter().next().unwrap(),
            }
        })
        .await?;

    // Retrieve users by identities
    let users_2 =
        User::get_batch_users_by_identity(&body.identities, &mut db_pool.get().await?).await?;

    // Merge both user lists
    let users: HashMap<_, _> = users_1
        .into_iter()
        .chain(users_2)
        .map(|u| (u.id, u))
        .collect();

    let user_to_identities = User::get_batch_user_identities(
        users.keys().copied().collect::<Vec<i64>>().as_slice(),
        &mut db_pool.get().await?,
    )
    .await?
    .into_iter()
    .map(|(id, authz::identity::UserInfo { identities, .. })| (id, identities))
    .collect::<HashMap<_, _>>();

    if let Some(missing_identity) = body
        .identities
        .into_iter()
        .find(|i| !user_to_identities.values().flatten().contains(i))
    {
        return Err(AuthzError::UnknownIdentity {
            identity: missing_identity,
        }
        .into());
    }

    // Fetch groups for each user
    let mut groups_by_user = HashMap::new();
    for &user_id in users.keys() {
        // TODO: optimize by batching calls to OpenFGA
        groups_by_user.insert(user_id, regulator.user_groups(&authz::User(user_id)).await?);
    }
    let group_ids: HashSet<i64> = groups_by_user.values().flatten().map(|g| g.0).collect();

    let settings = SelectionSettings::new()
        .filter(move || Group::ID.eq_any(group_ids.clone().into_iter().collect_vec()));
    let groups = Group::list(&mut db_pool.get().await?, settings).await?;
    let group_by_id = groups
        .into_iter()
        .map(|g| (g.id, g))
        .collect::<HashMap<_, _>>();

    let mut results = Vec::new();
    for (user_id, user) in users {
        // TODO: optimize by batching calls to OpenFGA
        let roles = regulator.user_roles(&authz::User(user_id)).await?;
        let groups = groups_by_user[&user_id]
            .iter()
            // Skip group if it does not exist
            .filter_map(|group_id| group_by_id.get(&group_id.0).cloned())
            .collect();
        results.push(UserInfo {
            id: user_id,
            name: user.name,
            identities: user_to_identities[&user_id].clone(),
            roles,
            groups,
        });
    }

    Ok(Json(results))
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq, Eq))]
pub(in crate::views) struct ResourcePrivileges {
    resource_id: i64,
    privileges: HashSet<InfraPrivilege>,
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
    Extension(user): Extension<Option<authz::User>>,
    Extension(roles): Extension<Vec<Role>>,
    Extension(authn): Extension<crate::authentication::Authentication>,
    Json(mut resources_ids): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<ResourcePrivileges>>>> {
    if matches!(
        authn,
        crate::authentication::Authentication::Unauthenticated
    ) {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let mut result = HashMap::<_, Vec<_>>::new();
    let result_infras = result.entry(ResourceType::Infra).or_default();

    let mut conn = db_pool.get().await?;
    let infra_ids = resources_ids
        .remove(&ResourceType::Infra) // change when more resources are supported
        .into_iter()
        .flatten();
    if let Some(user) = user {
        let infras = infra_ids.map(authz::Infra);
        let protected_privileges =
            infras.map(|infra| v2::infra_privileges(user, infra).zip(v2::Protected::value(infra)));
        let authorizer =
            crate::authorizers::UserAuthorizer::new(user, roles, regulator.openfga(), conn);
        let accesses = authorizer.authorize_all(protected_privileges).await?;
        for access in v2::Access::access_all(accesses).await? {
            match access {
                Ok((privileges, infra)) => {
                    result_infras.push(ResourcePrivileges {
                        resource_id: *infra,
                        privileges,
                    });
                }
                Err(Check::InfraExists(_)) => {
                    // not an error under the target API
                    // (though maybe we should revisit it?)
                }
                Err(Check::IssuerHasInfraPrivilege(InfraPrivilege::CanRead, infra)) => {
                    result_infras.push(ResourcePrivileges {
                        resource_id: *infra,
                        privileges: HashSet::new(),
                    });
                }
                Err(Check::SubjectExists(authz::Subject::User(_))) => {
                    panic!("race condition: user deleted");
                }
                Err(check @ Check::IssuerHasInfraPrivilege(_, _)) | Err(check) => {
                    impossible!(check)
                }
            }
        }
    } else {
        // Authorization is skipped (--enable-authorization or header), everyone has full access
        debug_assert!(matches!(
            authn,
            crate::authentication::Authentication::Skip { .. }
        ));
        let infras: Vec<_> = Infra::retrieve_batch_unchecked(&mut conn, infra_ids).await?;
        result_infras.extend(infras.into_iter().map(|infra| ResourcePrivileges {
            resource_id: infra.id,
            privileges: HashSet::from([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
            ]),
        }));
    }

    Ok(Json(result))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct UserResourceGrant {
    id: i64,
    grant: InfraGrant,
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
    Extension(roles): Extension<Vec<authz::Role>>,
    Extension(user): Extension<Option<authz::User>>,
    Json(body): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<UserResourceGrant>>>> {
    let Some(user) = user else {
        return Err(AuthorizationError::Unauthorized.into());
    };
    let authorizer = UserAuthorizer::new(user, roles, regulator.openfga(), db_pool.get().await?);

    let mut response = HashMap::<_, Vec<UserResourceGrant>>::new();
    if let Some(infra_ids) = body.get(&ResourceType::Infra) {
        for infra_id in infra_ids {
            let grant_access = authz::v2::infra_effective_grant(
                authz::Subject::user(user),
                authz::Infra(*infra_id),
            )
            .authorize(&authorizer)
            .await?;
            let grant = match grant_access.access().await? {
                Ok(Some(grant)) => grant,
                Ok(None) => continue,
                Err(Check::InfraExists(infra)) => {
                    tracing::warn!(%infra, "non-existent infra — skipping");
                    continue;
                }
                Err(Check::IssuerHasInfraPrivilege(privilege, infra)) => {
                    debug_assert_eq!(privilege, InfraPrivilege::CanRead);
                    tracing::warn!(%infra, "user cannot read infra — skipping");
                    continue;
                }
                Err(Check::SubjectExists(subject)) => {
                    unreachable!("{subject} exists or race condition")
                }
                Err(check) => impossible!(check),
            };
            response
                .entry(ResourceType::Infra)
                .or_default()
                .push(UserResourceGrant {
                    id: *infra_id,
                    grant,
                });
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
    grant: InfraGrant,
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
pub(in crate::views) async fn my_grants_on_resource(
    Extension(user): Extension<Option<authz::User>>,
    Extension(roles): Extension<Vec<authz::Role>>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
    Path(ResourceIdParam { resource_id }): Path<ResourceIdParam>,
) -> Result<Json<Vec<SubjectGrant>>> {
    let Some(user) = user else {
        return Err(AuthorizationError::Unauthorized.into());
    };
    // Ask OpenFGA about grants on the resource
    let ((readers, writers), owners) = match resource_type {
        ResourceType::Infra => {
            let infra = authz::Infra(resource_id);
            let conn = db_pool.get().await?;
            let openfga = regulator.openfga();
            let authorizer = UserAuthorizer {
                user,
                roles,
                openfga,
                conn,
            };
            authorizer
                .authorize(
                    authz::v2::infra_granted_subjects(infra, InfraGrant::Reader)
                        .zip(authz::v2::infra_granted_subjects(infra, InfraGrant::Writer))
                        .zip(authz::v2::infra_granted_subjects(infra, InfraGrant::Owner)),
                )
                .await?
                .access()
                .await?
                .map_err(|err| match err {
                    Check::IssuerHasInfraPrivilege(InfraPrivilege::CanRead, ..) => {
                        AuthzError::Authz(AuthorizationError::Forbidden)
                    }
                    Check::InfraExists(_) => AuthzError::UnknownResource {
                        resource_id: infra.0,
                    },
                    rejection => impossible!(rejection),
                })?
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
                .expect("subjects_id is a subset of subjects_grant keys by construction");
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
    grant: InfraGrant,
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
    Extension(auth): AuthenticationExt,
    Json(body): Json<BodyUpdateGrants>,
) -> Result<impl IntoResponse> {
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

    match body {
        BodyUpdateGrants::Grant(grants) => {
            for GrantBody {
                resource_type,
                resource_id,
                subject_id,
                grant,
            } in grants
            {
                let subject = subjects
                    .get(&subject_id)
                    .ok_or_else(|| AuthzError::UnknownSubject { subject_id })?;
                match resource_type {
                    ResourceType::Infra => {
                        match &auth {
                            Authentication::Authenticated(authorizer) => {
                                authorizer
                                    .give_infra_grant(subject, &authz::Infra(resource_id), grant)
                                    .await
                            }
                            Authentication::SkipAuthorization { .. } => regulator
                                .give_infra_grant_unchecked(
                                    subject,
                                    &authz::Infra(resource_id),
                                    grant,
                                )
                                .await
                                .map(Authorization::Granted),
                            Authentication::Unauthenticated => {
                                return Err(AuthorizationError::Unauthorized.into());
                            }
                        }?
                        .allowed()?;
                    }
                }
            }
            Ok(StatusCode::CREATED)
        }
        BodyUpdateGrants::Revoke(revoke) => {
            for RevokeBody {
                resource_type,
                resource_id,
                subject_id,
            } in revoke
            {
                let subject = subjects
                    .get(&subject_id)
                    .ok_or_else(|| AuthzError::UnknownSubject { subject_id })?;
                match resource_type {
                    ResourceType::Infra => {
                        match &auth {
                            Authentication::Authenticated(authorizer) => {
                                authorizer
                                    .revoke_infra_grants(subject, &authz::Infra(resource_id))
                                    .await
                            }
                            Authentication::SkipAuthorization { .. } => regulator
                                .revoke_infra_grants_unchecked(subject, &authz::Infra(resource_id))
                                .await
                                .map(Authorization::Granted),
                            Authentication::Unauthenticated => {
                                return Err(AuthorizationError::Unauthorized.into());
                            }
                        }?
                        .allowed()?;
                    }
                }
            }
            Ok(StatusCode::NO_CONTENT)
        }
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
    use std::collections::HashSet;

    use authz::v2::TestClientExt as _;
    use axum::http::StatusCode;

    use crate::fixtures::create_empty_infra;
    use crate::views::test_app::test_app;

    use super::*;
    use crate::fixtures::create_small_infra;
    use crate::views::test_app::TestRequestExt;
    use pretty_assertions::assert_eq;

    use serde_json::json;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges() {
        let app = test_app!().enable_authorization(true).build();
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
            .fetch(
                app.post("/authz/me/privileges")
                    .by_user(&toto)
                    .json(&json!({
                       "infra": [infra1, infra2, infra3, infra4]
                    })),
            )
            .await
            .assert_status(StatusCode::OK)
            .json_into::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
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
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
            ])
        );
        assert_eq!(
            privileges.remove(&infra2).unwrap(),
            HashSet::from([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
            ])
        );
        assert_eq!(
            privileges.remove(&infra3).unwrap(),
            HashSet::from([InfraPrivilege::CanRead, InfraPrivilege::CanShareRead])
        );
        assert_eq!(privileges.remove(&infra4).unwrap(), HashSet::from([]));
        assert!(!privileges.contains_key(&infra_unused));
    }

    // TODO: merge with the previous test once test deadlocks are fixed
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_bis() {
        let app = test_app!().enable_authorization(true).build();
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
            .fetch(
                app.post("/authz/me/privileges")
                    .by_user(&tata)
                    .json(&json!({
                       "infra": [infra1, infra2, infra3, infra4]
                    })),
            )
            .await
            .assert_status(StatusCode::OK)
            .json_into::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
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
            HashSet::from([InfraPrivilege::CanRead, InfraPrivilege::CanShareRead])
        );
        assert_eq!(privileges.remove(&infra2).unwrap(), HashSet::from([]));
        assert_eq!(
            privileges.remove(&infra3).unwrap(),
            HashSet::from([InfraPrivilege::CanRead, InfraPrivilege::CanShareRead,])
        );
        assert_eq!(
            privileges.remove(&infra4).unwrap(),
            HashSet::from([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership
            ])
        );
        assert!(!privileges.contains_key(&infra_unused));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_authz_disabled() {
        let app = test_app!().enable_authorization(false).build();
        let Infra { id: infra, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let mut privileges = app
            .fetch(app.post("/authz/me/privileges").json(&json!({
               "infra": [infra]
            })))
            .await
            .assert_status(StatusCode::OK)
            .json_into::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
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
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
            ])
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_me_grants() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let infra_no_grant = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("test", "Test")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;

        // Ask the grant of the user for the infra
        let request = app.post("/authz/me/grants").by_user(&user).json(&json!({
            "infra": [infra.id],
        }));
        let response: HashMap<ResourceType, Vec<UserResourceGrant>> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        // Check the direct grant is there
        assert_eq!(
            response.get(&ResourceType::Infra).unwrap(),
            &[UserResourceGrant {
                id: infra.id,
                grant: InfraGrant::Reader
            }]
        );

        let _group = app
            .group("Group")
            .with_members([&user])
            .with_infra_grant(infra.id, InfraGrant::Writer)
            .create()
            .await;

        // Ask the grant of the user for the infra again
        let request = app.post("/authz/me/grants").by_user(&user).json(&json!({
            "infra": [infra.id, infra_no_grant.id, infra_no_grant.id + 1000],
        }));
        let response: HashMap<ResourceType, Vec<UserResourceGrant>> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        // Check the inherited grant from the group has overridden by the user's direct grant
        // Unreadable and non-existent infras are filtered out
        assert_eq!(
            response.get(&ResourceType::Infra).unwrap(),
            &[UserResourceGrant {
                id: infra.id,
                grant: InfraGrant::Writer
            }]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn users_grants_for_resource_id_test() {
        // This test start with an infra with one owner, one writer, and 5 readers
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;

        for name in ["ben", "hal", "joe", "luc", "mar"] {
            app.user(name, name)
                .with_roles([Role::OperationalStudies])
                .with_infra_grant(infra.id, InfraGrant::Reader)
                .create()
                .await;
        }

        // Get the full user list for the infra
        let request_all = app
            .get(&format!("/authz/{}/{}", ResourceType::Infra, infra.id))
            .by_user(&user);
        let subjects: Vec<SubjectGrant> = app
            .fetch(request_all)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(subjects.len(), 6);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn groups_grants_on_resource() {
        let app = test_app!().enable_authorization(true).build();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let alice = app
            .user("alice", "Alice")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;
        let bob = app
            .user("bob", "Bob")
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;
        let tom = app
            .user("tom", "Tom")
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;
        let jerry = app
            .user("jerry", "Jerry")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;
        let alice_and_bob = app
            .group("Alice and Bob")
            .with_members([&alice, &bob])
            .with_infra_grant(infra.id, InfraGrant::Writer)
            .create()
            .await;
        let tom_and_jerry = app
            .group("Tom and Jerry")
            .with_members([&tom, &jerry])
            .create()
            .await;

        let subjects: Vec<SubjectGrant> = app
            .fetch(
                app.get(&format!("/authz/{}/{}", ResourceType::Infra, infra.id))
                    .by_user(&alice),
            )
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let grants = subjects
            .into_iter()
            .map(|SubjectGrant { id, grant, .. }| (id, grant))
            .collect::<HashMap<_, _>>();

        assert_eq!(grants.get(&alice.id), Some(&InfraGrant::Writer)); // group grants can supersede direct user grants
        assert_eq!(grants.get(&bob.id), Some(&InfraGrant::Owner)); // but do not override them
        assert_eq!(grants.get(&tom.id), Some(&InfraGrant::Owner)); // direct user grant
        assert_eq!(grants.get(&jerry.id), Some(&InfraGrant::Reader)); // likewise
        assert_eq!(grants.get(&alice_and_bob.id), Some(&InfraGrant::Writer)); // group direct grant
        assert_eq!(grants.get(&tom_and_jerry.id), None); // no group grant (not even there in the response)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn grants_test() {
        // This test starts with a user that is the owner of an infra.
        // Then it creates a new user and adds it as a writer to the infra.
        // Finally, it removes the new user from the infra.
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let openfga = app.openfga();
        let infra = authz::Infra(create_small_infra(&mut db_pool.get_ok()).await.id);
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(*infra, InfraGrant::Owner)
            .create()
            .await;

        // Create a new user and add it as a writer to the infra with the grant API
        let writer = authz::User::from(app.user("writer", "Writer").create().await);
        let request_grant = app.post("/authz/grants").by_user(&owner).json(&json!({
            "grant": [
                {
                    "subject_id": *writer,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra,
                    "grant": InfraGrant::Writer
                }
            ]
        }));
        app.fetch(request_grant)
            .await
            .assert_status(StatusCode::CREATED);

        // Check that the new user has the good grant
        assert_eq!(
            openfga.infra_direct_grant(writer, infra).await,
            Some(InfraGrant::Writer)
        );

        // Remove the user from the API
        let request_revoke = app.post("/authz/grants").by_user(&owner).json(&json!({
            "revoke": [
                {
                    "subject_id": *writer,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra
                }
            ]
        }));
        app.fetch(request_revoke)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        // Check that the new user has the good grant
        assert_eq!(openfga.infra_direct_grant(writer, infra).await, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn give_grant_to_groups() {
        let app = test_app!().enable_authorization(true).build();
        let openfga = app.openfga();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let alice = app
            .user("alice", "Alice")
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;
        let bob = app.user("bob", "Bob").create().await;
        let alice_and_bob = app
            .group("Alice and Bob")
            .with_members([&alice, &bob])
            .create()
            .await;
        let infra = authz::Infra(infra.id);
        let alice_info = alice.clone();
        let alice = authz::User::from(alice);
        let bob = authz::User::from(bob);
        let alice_and_bob = authz::Group::from(alice_and_bob);

        app.fetch(app.post("/authz/grants").by_user(&alice_info).json(&json!({
            "grant": [
                {
                    "subject_id": *alice_and_bob,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra,
                    "grant": InfraGrant::Writer
                },
                {
                    "subject_id": *bob,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra,
                    "grant": InfraGrant::Reader
                }
            ]
        })))
        .await
        .assert_status(StatusCode::CREATED);

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

        app.assert_infra_grant(*infra, *bob, Some(InfraGrant::Writer)); // inherited group grant
        app.assert_infra_grant(*infra, *alice, Some(InfraGrant::Owner)); // inherited group grant superseded by direct user grant

        app.fetch(app.post("/authz/grants").by_user(&alice_info).json(&json!({
            "revoke": [
                {
                    "subject_id": *alice_and_bob,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra
                }
            ]
        })))
        .await
        .assert_status(StatusCode::NO_CONTENT);

        assert_eq!(openfga.infra_direct_grant(alice_and_bob, infra).await, None); // group grant removed
        assert_eq!(
            openfga.infra_direct_grant(bob, infra).await,
            Some(InfraGrant::Reader)
        ); // bob's direct grant is still there
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn adding_a_grant_that_already_exists() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;

        // Adding OWNER on the same user/infra
        let request_revoke = app.post("/authz/grants").by_user(&user).json(&json!({
            "grant": [
                {
                    "subject_id": user.id,
                    "resource_type": ResourceType::Infra,
                    "resource_id": infra.id,
                    "grant": InfraGrant::Owner
                }
            ]
        }));
        app.fetch(request_revoke)
            .await
            .assert_status(StatusCode::CREATED);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn skipped_authz_can_set_and_remove_grants() {
        let app = test_app!().enable_authorization(true).build();
        let openfga = app.openfga();
        let db_pool = app.db_pool();
        let infra = authz::Infra(create_small_infra(&mut db_pool.get_ok()).await.id);
        let user = authz::User::from(
            app.user("authz", "Authz")
                .with_infra_grant(*infra, InfraGrant::Owner)
                .create()
                .await,
        );

        // Adding OWNER on the same user/infra
        let request_grant = app.post("/authz/grants").skip_authz().json(&json!({
            "grant": [
                {
                    "subject_id": *user,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra,
                    "grant": InfraGrant::Owner
                }
            ]
        }));
        app.fetch(request_grant)
            .await
            .assert_status(StatusCode::CREATED);

        assert_eq!(
            openfga.infra_direct_grant(user, infra).await,
            Some(InfraGrant::Owner)
        );

        // Remove the grant
        let request_revoke = app.post("/authz/grants").skip_authz().json(&json!({
            "revoke": [
                {
                    "subject_id": *user,
                    "resource_type": ResourceType::Infra,
                    "resource_id": *infra
                }
            ]
        }));
        app.fetch(request_revoke)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        assert_eq!(openfga.infra_direct_grant(user, infra).await, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn remove_a_grant_that_doesnt_exists() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create()
            .await;

        let other = app.user("other", "Other").create().await;

        // Remove the READER grant should not fail
        let request_grant = app.post("/authz/grants").by_user(&owner).json(&json!({
            "revoke": [
                {
                    "subject_id": other.id,
                    "resource_type": ResourceType::Infra,
                    "resource_id": infra.id,
                }
            ]
        }));
        app.fetch(request_grant)
            .await
            .assert_status(StatusCode::NO_CONTENT);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_test() {
        let app = test_app!().enable_authorization(true).build();
        let user = app
            .user("test", "test")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let request = app.get("/authz/me").by_user(&user);
        let user_data = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: user.id,
                name: "test".to_string(),
                roles: vec![Role::OperationalStudies],
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_authorization_disabled() {
        let app = test_app!()
            .enable_authorization(false)
            .with_openfga_store()
            .build();
        let user = app.user("test", "test").create().await;

        let request = app.get("/authz/me").by_user(&user);
        let WhoamiResponse { roles, .. } = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<WhoamiResponse>();

        assert_eq!(roles, vec![Role::Admin]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_groups_test() {
        let app = test_app!().enable_authorization(true).build();
        let user_1 = app.user("test1", "test1").create().await;
        let user_2 = app.user("test2", "test2").create().await;
        let group_1 = app
            .group("group_1")
            .with_members([&user_1, &user_2])
            .create()
            .await;
        let group_2 = app.group("group_2").with_members([&user_1]).create().await;

        let request_1 = app.get("/authz/me/groups").by_user(&user_1);
        let request_2 = app.get("/authz/me/groups").by_user(&user_2);

        let mut groups_user_1 = app
            .fetch(request_1)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<Vec<Group>>();
        let groups_user_2 = app
            .fetch(request_2)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<Vec<Group>>();

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
    async fn user_groups_authorization_disabled() {
        let app = test_app!()
            .enable_authorization(false)
            .with_openfga_store()
            .build();
        let user = app.user("test", "test").create().await;

        let request = app.get("/authz/me/groups").by_user(&user);
        app.fetch(request)
            .await
            .assert_status(StatusCode::UNAUTHORIZED);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_groups_test() {
        let app = test_app!().enable_authorization(true).build();

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
        let request = app.get("/authz/groups").by_user(&admin);
        let groups = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into::<Vec<Group>>();

        // Verify all groups are returned
        assert_eq!(groups.len(), 3);
        assert!(groups[0].id == group_1.id && groups[0].name == "G1");
        assert!(groups[1].id == group_2.id && groups[1].name == "G2");
        assert!(groups[2].id == group_3.id && groups[2].name == "G3");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_groups_forbidden_non_admin() {
        let app = test_app!().enable_authorization(true).build();

        // Create a non-admin user
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Try to list groups as non-admin
        let request = app.get("/authz/groups").by_user(&user);
        app.fetch(request)
            .await
            .assert_status(StatusCode::FORBIDDEN);
    }
}
