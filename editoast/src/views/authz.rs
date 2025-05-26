use std::collections::HashMap;
use std::collections::HashSet;

use crate::error::Result;
use crate::models;
use crate::models::Infra;
use crate::models::prelude::*;
use axum::Extension;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Json;
use editoast_authz as authz;
use editoast_authz::InfraGrant;
use editoast_authz::InfraPrivilege;
use editoast_authz::Role;
use editoast_derive::EditoastError;
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
use super::pagination::PaginatedList;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;

crate::routes! {
    "/authz" => {
        "/me" => {
            whoami,
            "/privileges" => user_privileges,
            "/grants" => user_authorizations,
        },
        "/grants" => update_grants,
        "/{resource_type}/{resource_id}" => subjects_with_grant_on_resource,
    },
}

editoast_common::schemas! {
    InfraGrant,
    InfraPrivilege,
    ResourceType,
    Role,
    SubjectType,

    // not inlined because BodyUpdateGrants is an enum and derive(ToSchema) cannot iniline
    GrantBody,
    RevokeBody,
}

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
enum ResourceType {
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
    #[error("Unknown resource {subject_id}")]
    #[editoast_error(status = 404)]
    UnknownSubject { subject_id: i64 },
    #[error("Authorization error")]
    Authz(#[from] AuthorizationError),
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
struct WhoamiResponse {
    id: i64,
    name: String,
    roles: Vec<Role>,
}

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
async fn whoami(Extension(auth): AuthenticationExt) -> Result<Json<WhoamiResponse>> {
    Ok(Json(WhoamiResponse {
        // TODO: don't return -1 and a hardcoded name, return a different schema instead, requires frontend changes
        id: auth.user_id()?.unwrap_or(-1),
        name: auth.user_name()?.unwrap_or_else(|| "OSRD user".to_string()),
        roles: auth.user_roles().await?.into_iter().collect(),
    }))
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq, Eq))]
struct ResourcePrivileges {
    resource_id: i64,
    privileges: HashSet<InfraPrivilege>,
}

#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(HashMap<ResourceType, Vec<i64>>),
        description = "The resources of which to get the request sender's privileges. If a resource doesn't exist, it will be omitted.",
    ),
    responses((
        status = 200,
        description = "The privileges of the user sending the request over each requested resource.",
        body = inline(HashMap<ResourceType, Vec<ResourcePrivileges>>)
    )),
)]
async fn user_privileges(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(body): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<ResourcePrivileges>>>> {
    let authorizer = auth.authorizer()?;

    let resources = body
        .into_iter()
        .flat_map(|(rtype, ids)| std::iter::repeat(rtype).zip(ids.into_iter()));

    let mut result = HashMap::<_, Vec<_>>::new();
    for (resource_type, resource_id) in resources {
        match resource_type {
            ResourceType::Infra => {
                // check that the infra exists before to check the grants
                if Infra::exists(&mut db_pool.get().await?, resource_id).await? {
                    result
                        .entry(ResourceType::Infra)
                        .or_default()
                        .push(ResourcePrivileges {
                            resource_id,
                            privileges: authorizer
                                .infra_privileges(&authz::Infra(resource_id))
                                .await
                                .map_err(AuthzError::from)?,
                        });
                }
            }
        }
    }

    Ok(Json(result))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
struct UserResourceGrant {
    id: i64,
    grant: InfraGrant,
}

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
async fn user_authorizations(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(body): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<UserResourceGrant>>>> {
    let authorizer = auth.authorizer()?;
    let mut response = HashMap::<_, Vec<UserResourceGrant>>::new();
    let conn = &mut db_pool.get().await?;

    if let Some(infra_ids) = body.get(&ResourceType::Infra) {
        for infra_id in infra_ids {
            // check that the infra exists before to check the grants
            if Infra::exists(conn, *infra_id).await? {
                let Some(grant) = authorizer
                    .infra_grant(&authz::Infra(*infra_id))
                    .await
                    .map_err(AuthzError::from)?
                else {
                    continue; // skip if the user has no grant on this infra
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
    }

    Ok(Json(response))
}

#[derive(Deserialize, IntoParams)]
struct ResourceTypeParam {
    resource_type: ResourceType,
}

#[derive(Deserialize, IntoParams)]
struct ResourceIdParam {
    resource_id: i64,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectGrant {
    id: i64,
    name: String,
    r#type: SubjectType,
    grant: InfraGrant,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectsWithGrantOnResource {
    #[schema(inline)]
    subjects: Vec<SubjectGrant>,
    stats: PaginationStats,
}

#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    params(ResourceTypeParam, ResourceIdParam, PaginationQueryParams<100>),
    responses(
        (status = 200, description = "Get list of user that have a grant on the resource", body = inline(SubjectsWithGrantOnResource)),
    ),
)]
async fn subjects_with_grant_on_resource(
    Extension(authn): AuthenticationExt,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
    Path(ResourceIdParam { resource_id }): Path<ResourceIdParam>,
    Query(pagination): Query<PaginationQueryParams<100>>,
) -> Result<Json<SubjectsWithGrantOnResource>> {
    let (readers, writers, owners) = match resource_type {
        ResourceType::Infra => {
            let infra = authz::Infra(resource_id);
            // One must be able to interact with the resource in order to
            // consult who has access to it.
            authn
                .check_authorization(async |authorizer| {
                    authorizer.authorize_infra_read(&infra).await
                })
                .await?;
            tokio::try_join!(
                regulator.get_infra_readers(&infra),
                regulator.get_infra_writers(&infra),
                regulator.get_infra_owners(&infra)
            )
            .map_err(AuthzError::from)?
        }
    };

    let subjects_grant = readers
        .into_iter()
        .map(|s| (s, InfraGrant::Reader))
        .chain(writers.into_iter().map(|s| (s, InfraGrant::Writer)))
        .chain(owners.into_iter().map(|s| (s, InfraGrant::Owner)))
        .map(|(subject, grant)| {
            (
                subject.expect_left("group support has not yet been implemented"),
                grant,
            )
        })
        .collect::<HashMap<_, _>>();
    let user_ids = subjects_grant
        .keys()
        .map(|authz::User(id)| *id)
        .collect_vec();

    let (users, stats) = models::User::list_paginated(
        &mut db_pool.get().await?,
        pagination
            .into_selection_settings()
            .filter(move || models::User::ID.eq_any(user_ids.clone())),
    )
    .await?;

    let subjects_grant = users
        .into_iter()
        .filter_map(|models::User { id, name, .. }| {
            let user = authz::User(id);
            let grant = subjects_grant.get(&user)?;
            Some(SubjectGrant {
                id,
                name,
                r#type: SubjectType::User,
                grant: *grant,
            })
        })
        .collect_vec();

    Ok(Json(SubjectsWithGrantOnResource {
        subjects: subjects_grant,
        stats,
    }))
}

#[derive(Deserialize, ToSchema)]
struct GrantBody {
    resource_type: ResourceType,
    resource_id: i64,
    subject_id: i64,
    grant: InfraGrant,
}

#[derive(Deserialize, ToSchema)]
struct RevokeBody {
    resource_type: ResourceType,
    resource_id: i64,
    subject_id: i64,
}

/// `grant` XOR `revoke` is expected
#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
enum BodyUpdateGrants {
    Grant(Vec<GrantBody>),
    Revoke(Vec<RevokeBody>),
}

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
async fn update_grants(
    Extension(auth): AuthenticationExt,
    Json(body): Json<BodyUpdateGrants>,
) -> Result<impl IntoResponse> {
    let authorizer = auth.authorizer()?;
    match body {
        BodyUpdateGrants::Grant(grants) => {
            for GrantBody {
                resource_type,
                resource_id,
                subject_id,
                grant,
            } in grants
            {
                let subject = authz::User(subject_id);
                match resource_type {
                    ResourceType::Infra => {
                        authorizer
                            .give_infra_grant(&subject, &authz::Infra(resource_id), grant)
                            .await?
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
                match resource_type {
                    ResourceType::Infra => {
                        authorizer
                            .revoke_infra_grants(
                                &authz::User(subject_id),
                                &authz::Infra(resource_id),
                            )
                            .await?
                            .allowed()?;
                    }
                }
            }
            Ok(StatusCode::NO_CONTENT)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use axum::http::StatusCode;

    use crate::models::fixtures::create_empty_infra;
    use crate::views::test_app::test_app;

    use super::*;
    use crate::models::fixtures::create_small_infra;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt;
    use editoast_authz::identity::UserInfo;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
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
            .create();

        let mut privileges = app
            .fetch(
                app.post("/authz/me/privileges")
                    .by_user(&toto)
                    .json(&json!({
                       "infra": [infra1, infra2, infra3, infra4]
                    })),
            )
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
            .create();

        let mut privileges = app
            .fetch(
                app.post("/authz/me/privileges")
                    .by_user(&tata)
                    .json(&json!({
                       "infra": [infra1, infra2, infra3, infra4]
                    })),
            )
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

    #[rstest]
    async fn user_authorizations_test() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("test", "Test")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

        // Ask the authorizations of the user for the infra
        let request = app.post("/authz/me/grants").by_user(&user).json(&json!({
            "infra": [infra.id],
        }));
        let response: HashMap<String, Vec<UserResourceGrant>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // Checks
        assert_eq!(response.contains_key("infra"), true);
        let infra_grants = response.get("infra").unwrap();
        assert_eq!(
            infra_grants,
            &[UserResourceGrant {
                id: infra.id,
                grant: InfraGrant::Owner
            }]
        );
    }

    #[rstest]
    async fn users_grants_for_resource_id_test() {
        // This test start with an infra with one owner, one writer, and 5 readers
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

        Vec::from(["ben", "hal", "joe", "luc", "mar"])
            .into_iter()
            .for_each(|name| {
                app.user(name, name)
                    .with_roles([Role::OperationalStudies])
                    .with_infra_grant(infra.id, InfraGrant::Reader)
                    .create();
            });

        // Get the full user list for the infra
        let request_all = app
            .get(&format!(
                "/authz/{}/{}?page=1&page_size=10",
                ResourceType::Infra,
                infra.id
            ))
            .by_user(&user);
        let SubjectsWithGrantOnResource { subjects, .. } = app
            .fetch(request_all)
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(subjects.len(), 6);

        // Get the partial user list for the infra to test pagination
        let request_all = app
            .get(&format!(
                "/authz/{}/{}?page=2&page_size=5",
                ResourceType::Infra,
                infra.id
            ))
            .by_user(&user);
        let SubjectsWithGrantOnResource { subjects, .. } = app
            .fetch(request_all)
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(subjects.len(), 1);
    }

    #[rstest]
    async fn grants_test() {
        // This test starts with a user that is the owner of an infra.
        // Then it creates a new user and adds it as a writer to the infra.
        // Finally, it removes the new user from the infra.
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

        // Check that user is the owner of the infra via /authz/Infra/{infra_id}
        check_grant_on_resource(&app, &owner, infra.id, owner.id, Some(InfraGrant::Owner));

        // Create a new user and add it as a writer to the infra with the grant API
        let writer = app.user("writer", "Writer").create();
        let request_grant = app.post("/authz/grants").by_user(&owner).json(&json!({
            "grant": [
                {
                    "subject_id": writer.id,
                    "resource_type": ResourceType::Infra,
                    "resource_id": infra.id,
                    "grant": InfraGrant::Writer
                }
            ]
        }));
        app.fetch(request_grant).assert_status(StatusCode::CREATED);
        // Check that the new user has the good grant
        check_grant_on_resource(&app, &owner, infra.id, writer.id, Some(InfraGrant::Writer));

        // Remove the user from the API
        let request_revoke = app.post("/authz/grants").by_user(&owner).json(&json!({
            "revoke": [
                {
                    "subject_id": writer.id,
                    "resource_type": ResourceType::Infra,
                    "resource_id": infra.id
                }
            ]
        }));
        app.fetch(request_revoke)
            .assert_status(StatusCode::NO_CONTENT);
        // Check that the new user has the good grant
        check_grant_on_resource(&app, &owner, infra.id, writer.id, None);
    }

    #[rstest]
    async fn adding_a_grant_that_already_exists() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

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
        app.fetch(request_revoke).assert_status(StatusCode::CREATED);
    }

    #[rstest]
    async fn remove_a_grant_that_doesnt_exists() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let owner = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

        let other = app.user("other", "Other").create();

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
            .assert_status(StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn whoami_test() {
        let app = test_app!().enable_authorization(true).build();
        let user = app
            .user("test", "test")
            .with_roles([Role::OperationalStudies])
            .create();

        let request = app.get("/authz/me").by_user(&user);
        let user_data = app
            .fetch(request)
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

    #[rstest]
    async fn whoami_authorization_disabled() {
        let app = test_app!().enable_authorization(false).build();
        let user = app.user("test", "test").create();

        let request = app.get("/authz/me").by_user(&user);
        let WhoamiResponse { roles, .. } = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<WhoamiResponse>();

        assert_eq!(roles, vec![Role::Admin]);
    }

    fn check_grant_on_resource(
        app: &TestApp,
        by_user: &impl AsRef<UserInfo>,
        infra_id: i64,
        user_id: i64,
        grant: Option<InfraGrant>,
    ) {
        let request = app
            .get(&format!("/authz/{}/{}", ResourceType::Infra, infra_id))
            .by_user(by_user);
        let SubjectsWithGrantOnResource {
            subjects: subjects_grant,
            ..
        } = app.fetch(request).assert_status(StatusCode::OK).json_into();

        match grant {
            Some(grant) => {
                assert_eq!(
                    true,
                    subjects_grant
                        .into_iter()
                        .any(|s| s.id == user_id && s.grant == grant)
                );
            }
            None => {
                assert_eq!(false, subjects_grant.into_iter().any(|s| s.id == user_id));
            }
        }
    }
}
