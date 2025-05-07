use std::collections::HashMap;

use crate::error::Result;
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
use editoast_authz::Role;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;
use super::AuthorizerError;
use super::pagination::PaginationQueryParams;

crate::routes! {
    "/authz" => {
        "/me" => whoami,
        "/me/grants" => user_authorizations,
        "/grants" => update_grants,
        "/{resource_type}/{resource_id}" =>  users_grants_for_resource_id,
        "/grants/{resource_type}"=> privileges_by_resource_type,
    },
}

editoast_common::schemas! {
    InfraGrant,
    InfraPrivilege,
    Resource,
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

#[derive(Display, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(test, derive(Debug))]
enum Resource {
    Infra,
}

#[derive(Display, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(test, derive(Debug))]
pub(in crate::views) enum InfraGrant {
    Reader,
    Writer,
    Owner,
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

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "authz")]
enum ResourceError {
    #[error("unknown resource type {resource_type}")]
    #[editoast_error(status = 404)]
    UnknownResourceType { resource_type: String },
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
        content = inline(HashMap<Resource, Vec<i64>>),
        description = "HashMap of resource type with a list of resource id to get the grants for. If a resource doesn't exist, it will be omitted.",
    ),
    responses((
        status = 200,
        description = "Get grants info of the current user for the given resources in body",
        body = inline(HashMap<Resource, Vec<UserResourceGrant>>)
    )),
)]
async fn user_authorizations(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(body): Json<HashMap<Resource, Vec<i64>>>,
) -> Result<Json<HashMap<Resource, Vec<UserResourceGrant>>>> {
    let authorizer = auth.authorizer()?;
    let mut response = HashMap::<_, Vec<UserResourceGrant>>::new();
    let conn = &mut db_pool.get().await?;

    if let Some(infra_ids) = body.get(&Resource::Infra) {
        for infra_id in infra_ids {
            // check that the infra exists before to check the grants
            if Infra::exists(conn, *infra_id).await? {
                let infra = authz::Infra(*infra_id);
                let (is_reader, is_writer, is_owner) = tokio::try_join!(
                    authorizer.check_infra_grant_reader(&infra),
                    authorizer.check_infra_grant_writer(&infra),
                    authorizer.check_infra_grant_owner(&infra)
                )
                .map_err(AuthzError::from)?;
                let grant = match (is_reader, is_writer, is_owner) {
                    (true, false, false) => InfraGrant::Reader,
                    (false, true, false) => InfraGrant::Writer,
                    (false, false, true) => InfraGrant::Owner,
                    (false, false, false) => continue,
                    _ => {
                        tracing::error!(
                            is_reader,
                            is_writer,
                            is_owner,
                            user_id = authorizer.user_id(),
                            infra_id = *infra_id,
                            "User has multiple grants on the same resource"
                        );
                        continue;
                    }
                };
                response
                    .entry(Resource::Infra)
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

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectItem {
    pub id: i64,
    pub name: String,
    pub r#type: SubjectType,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectGrant {
    #[schema(inline)]
    subject: SubjectItem,
    grant: InfraGrant,
}

#[derive(Deserialize, IntoParams)]
struct ResourceTypeParam {
    resource_type: Resource,
}

#[derive(Deserialize, IntoParams)]
struct ResourceIdParam {
    resource_id: i64,
}

#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    params(ResourceTypeParam, ResourceIdParam, PaginationQueryParams<100>),
    responses(
        (status = 200, description = "Get list of user that have access to the resource", body = inline(Vec<SubjectGrant>)),
    ),
)]
async fn users_grants_for_resource_id(
    Extension(auth): AuthenticationExt,
    State(AppState { regulator, .. }): State<AppState>,
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
    Path(ResourceIdParam { resource_id }): Path<ResourceIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<100>>,
) -> Result<Json<Vec<SubjectGrant>>> {
    // Validate pagination params
    let mut skip = (page - 1) * page_size;
    let mut result: Vec<SubjectGrant> = Vec::new();

    match resource_type {
        Resource::Infra => {
            // One must be able to interact with the resource in order to
            // consult who has access to it.
            auth.check_authorization(async |authorizer| {
                authorizer
                    .authorize_infra_read(&authz::Infra(resource_id))
                    .await
            })
            .await?;

            // Work on infra owners
            if result.len() < page_size as usize {
                let owners = regulator
                    .get_infra_owners(&authz::Infra(resource_id))
                    .await
                    .map_err(AuthzError::from)?;
                for owner in owners {
                    if skip > 0 {
                        skip -= 1;
                        continue;
                    }
                    result.push(SubjectGrant {
                        subject: SubjectItem {
                            id: owner.id,
                            name: owner.info.name,
                            r#type: SubjectType::User,
                        },
                        grant: InfraGrant::Owner,
                    });
                }
            }

            // Work on infra Writers
            if result.len() < page_size as usize {
                let writers = regulator
                    .get_infra_writers(&authz::Infra(resource_id))
                    .await
                    .map_err(AuthzError::from)?;
                for writer in writers {
                    if skip > 0 {
                        skip -= 1;
                        continue;
                    }
                    result.push(SubjectGrant {
                        subject: SubjectItem {
                            id: writer.id,
                            name: writer.info.name,
                            r#type: SubjectType::User,
                        },
                        grant: InfraGrant::Writer,
                    });
                }
            }

            // Work on infra readers
            if result.len() < page_size as usize {
                let readers = regulator
                    .get_infra_readers(&authz::Infra(resource_id))
                    .await
                    .map_err(AuthzError::from)?;
                for reader in readers {
                    if skip > 0 {
                        skip -= 1;
                        continue;
                    }
                    result.push(SubjectGrant {
                        subject: SubjectItem {
                            id: reader.id,
                            name: reader.info.name,
                            r#type: SubjectType::User,
                        },
                        grant: InfraGrant::Reader,
                    });
                }
            }
        }
    }

    Ok(Json(result))
}

#[derive(Display, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)] // needed due to "Can" prefix
#[cfg_attr(test, derive(Debug, Deserialize))]
pub enum InfraPrivilege {
    CanRead,
    CanShareRead,
    CanWrite,
    CanShareWrite,
    CanDelete,
    CanShareOwnership,
}

#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    params(ResourceTypeParam),
    responses(
        (status = 200, description = "Get privileges for each grant associated to the resource type", body = HashMap<InfraGrant, Vec<InfraPrivilege>>),
    ),
)]
async fn privileges_by_resource_type(
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
) -> Result<Json<HashMap<InfraGrant, Vec<InfraPrivilege>>>> {
    if resource_type != Resource::Infra {
        return Err(ResourceError::UnknownResourceType {
            resource_type: resource_type.to_string(),
        })?;
    }

    let mut infra_privileges: HashMap<InfraGrant, Vec<InfraPrivilege>> = HashMap::new();
    infra_privileges.insert(
        InfraGrant::Owner,
        vec![
            InfraPrivilege::CanRead,
            InfraPrivilege::CanShareRead,
            InfraPrivilege::CanWrite,
            InfraPrivilege::CanShareWrite,
            InfraPrivilege::CanDelete,
            InfraPrivilege::CanShareOwnership,
        ],
    );
    infra_privileges.insert(
        InfraGrant::Writer,
        vec![
            InfraPrivilege::CanRead,
            InfraPrivilege::CanShareRead,
            InfraPrivilege::CanWrite,
            InfraPrivilege::CanShareWrite,
        ],
    );
    infra_privileges.insert(
        InfraGrant::Reader,
        vec![InfraPrivilege::CanRead, InfraPrivilege::CanShareRead],
    );

    Ok(Json(infra_privileges))
}

#[derive(Deserialize, ToSchema)]
struct GrantBody {
    resource_type: Resource,
    resource_id: i64,
    subject_id: i64,
    grant: InfraGrant,
}

#[derive(Deserialize, ToSchema)]
struct RevokeBody {
    resource_type: Resource,
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
                    Resource::Infra => {
                        let resource = authz::Infra(resource_id);
                        match grant {
                            InfraGrant::Reader => {
                                authorizer
                                    .grant_infra_reader(&subject, &resource)
                                    .await?
                                    .allowed()?;
                            }
                            InfraGrant::Writer => {
                                authorizer
                                    .grant_infra_writer(&subject, &resource)
                                    .await?
                                    .allowed()?;
                            }
                            InfraGrant::Owner => {
                                authorizer
                                    .grant_infra_owner(&subject, &resource)
                                    .await?
                                    .allowed()?;
                            }
                        }
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
                    Resource::Infra => {
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
    use axum::http::StatusCode;

    use crate::views::test_app::test_app;

    use super::*;
    use crate::models::fixtures::create_small_infra;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt;
    use editoast_authz::subject::UserInfo;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

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
                Resource::Infra,
                infra.id
            ))
            .by_user(&user);
        let readers: Vec<SubjectGrant> = app
            .fetch(request_all)
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(readers.len(), 6);

        // Get the partial user list for the infra to test pagination
        let request_all = app
            .get(&format!(
                "/authz/{}/{}?page=2&page_size=5",
                Resource::Infra,
                infra.id
            ))
            .by_user(&user);
        let users: Vec<SubjectGrant> = app
            .fetch(request_all)
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(users.len(), 1);
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
                    "resource_type": Resource::Infra,
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
                    "resource_type": Resource::Infra,
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
    async fn privileges_by_resource_type_test() {
        let app = test_app!().enable_authorization(true).build();

        let request = app.get(&format!("/authz/grants/{}", Resource::Infra));
        let response: HashMap<InfraGrant, Vec<InfraPrivilege>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // Checks
        assert_eq!(response.get(&InfraGrant::Reader).unwrap().len(), 2);
        assert_eq!(response.get(&InfraGrant::Writer).unwrap().len(), 4);
        assert_eq!(response.get(&InfraGrant::Owner).unwrap().len(), 6);
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
                    "resource_type": Resource::Infra,
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
                    "resource_type": Resource::Infra,
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
            .get(&format!("/authz/{}/{}", Resource::Infra, infra_id))
            .by_user(by_user);
        let response: Vec<SubjectGrant> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        match grant {
            Some(grant) => {
                assert_eq!(
                    true,
                    response
                        .into_iter()
                        .any(|s| s.subject.id == user_id && s.grant == grant)
                );
            }
            None => {
                assert_eq!(false, response.into_iter().any(|s| s.subject.id == user_id));
            }
        }
    }
}
