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
    Resource,
    Role,
}

#[derive(Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Debug))]
enum Subject {
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
    #[error("Grant and Revoke cannot be defined at the same time")]
    SimultaneousGrantsAndRevokes,
    #[error("Unauthorized")]
    #[editoast_error(status = 403)]
    Unauthorized,
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
            AuthorizerError::Unauthorized => AuthzError::Unauthorized,
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
struct ResourceGrant {
    #[schema(inline)]
    resource_type: Resource,
    resource_id: i64,
    #[schema(inline)]
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
        body = inline(HashMap<Resource, Vec<ResourceGrant>>)
    )),
)]
async fn user_authorizations(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(body): Json<HashMap<Resource, Vec<i64>>>,
) -> Result<Json<HashMap<Resource, Vec<ResourceGrant>>>> {
    let authorizer = auth.authorizer()?;
    let mut result = HashMap::new();
    let conn = &mut db_pool.get().await?;

    if let Some(infra_ids) = body.get(&Resource::Infra) {
        for infra_id in infra_ids {
            // check that the infra exists before to check the grants
            if Infra::exists(conn, *infra_id).await? {
                let is_reader = authorizer
                    .check_infra_grant_reader(*infra_id)
                    .await
                    .map_err(AuthzError::from)?;
                if is_reader {
                    result.insert(
                        Resource::Infra,
                        vec![ResourceGrant {
                            resource_type: Resource::Infra,
                            resource_id: *infra_id,
                            grant: InfraGrant::Reader,
                        }],
                    );
                }

                let is_writer = authorizer
                    .check_infra_grant_writer(*infra_id)
                    .await
                    .map_err(AuthzError::from)?;
                if is_writer {
                    result.insert(
                        Resource::Infra,
                        vec![ResourceGrant {
                            resource_type: Resource::Infra,
                            resource_id: *infra_id,
                            grant: InfraGrant::Writer,
                        }],
                    );
                }

                let is_owner = authorizer
                    .check_infra_grant_owner(*infra_id)
                    .await
                    .map_err(AuthzError::from)?;
                if is_owner {
                    result.insert(
                        Resource::Infra,
                        vec![ResourceGrant {
                            resource_type: Resource::Infra,
                            resource_id: *infra_id,
                            grant: InfraGrant::Owner,
                        }],
                    );
                }
            }
        }
    }

    Ok(Json(result))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectItem {
    pub id: i64,
    pub name: String,
    #[schema(inline)]
    pub r#type: Subject,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize))]
struct SubjectGrant {
    #[schema(inline)]
    subject: SubjectItem,
    #[schema(inline)]
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
    params(ResourceTypeParam, ResourceIdParam, PaginationQueryParams),
    responses(
        (status = 200, description = "Get list of user that have access to the resource", body = inline(Vec<SubjectGrant>)),
    ),
)]
async fn users_grants_for_resource_id(
    State(AppState { regulator, .. }): State<AppState>,
    Path(ResourceTypeParam { resource_type }): Path<ResourceTypeParam>,
    Path(ResourceIdParam { resource_id }): Path<ResourceIdParam>,
    Query(pagination_params): Query<PaginationQueryParams>,
) -> Result<Json<Vec<SubjectGrant>>> {
    // Validate pagination params
    let (page, page_size) = pagination_params.validate(100)?.unpack();
    let mut skip = (page - 1) * page_size;

    let mut result: Vec<SubjectGrant> = Vec::new();

    match resource_type {
        Resource::Infra => {
            // Work on infra owners
            if result.len() < page_size as usize {
                let owners = regulator
                    .get_infra_owners(resource_id)
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
                            r#type: Subject::User,
                        },
                        grant: InfraGrant::Owner,
                    });
                }
            }

            // Work on infra Writers
            if result.len() < page_size as usize {
                let writers = regulator
                    .get_infra_writers(resource_id)
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
                            r#type: Subject::User,
                        },
                        grant: InfraGrant::Writer,
                    });
                }
            }

            // Work on infra readers
            if result.len() < page_size as usize {
                let readers = regulator
                    .get_infra_readers(resource_id)
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
                            r#type: Subject::User,
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
enum InfraPrivilege {
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
        (status = 200, description = "Get privileges for each grant associated to the resource type", body = inline(HashMap<Grant, Vec<InfraPrivilege>>)),
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
struct SubjectResourceGrant {
    #[schema(inline)]
    resource_type: Resource,
    resource_id: i64,
    subject_id: i64,
    #[schema(inline)]
    grant: InfraGrant,
}

#[derive(Deserialize, ToSchema)]
struct SubjectResource {
    resource_type: Resource,
    resource_id: i64,
    subject_id: i64,
}

#[derive(Deserialize, ToSchema)]
struct BodyUpdateGrants {
    #[schema(inline)]
    grant: Option<Vec<SubjectResourceGrant>>,
    #[schema(inline)]
    revoke: Option<Vec<SubjectResource>>,
}
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(BodyUpdateGrants),
        description = "List of new authorization to add or to remove (ie grants a resource to a person). Expect grant XOR revoke, not both",
    ),
    responses((
        status = 201,
        description = "Grants updated"
    )),
)]
async fn update_grants(
    Extension(auth): AuthenticationExt,
    Json(BodyUpdateGrants { grant, revoke }): Json<BodyUpdateGrants>,
) -> Result<impl IntoResponse> {
    let authorizer = auth.authorizer()?;
    if grant.is_none() && revoke.is_none() {
        return Err(AuthzError::SimultaneousGrantsAndRevokes.into());
    }
    if grant.is_some() && revoke.is_some() {
        return Err(AuthzError::SimultaneousGrantsAndRevokes.into());
    }

    if let Some(grants) = grant {
        for grant in grants {
            match grant.resource_type {
                Resource::Infra => match grant.grant {
                    InfraGrant::Reader => {
                        authorizer
                            .grant_infra_reader(grant.subject_id, grant.resource_id)
                            .await
                            .map_err(AuthzError::from)?;
                    }
                    InfraGrant::Writer => {
                        authorizer
                            .grant_infra_writer(grant.subject_id, grant.resource_id)
                            .await
                            .map_err(AuthzError::from)?;
                    }
                    InfraGrant::Owner => {
                        authorizer
                            .grant_infra_owner(grant.subject_id, grant.resource_id)
                            .await
                            .map_err(AuthzError::from)?;
                    }
                },
            }
        }
    }
    if let Some(revoke) = revoke {
        for grant in revoke {
            match grant.resource_type {
                Resource::Infra => {
                    authorizer
                        .revoke_infra_reader(grant.subject_id, grant.resource_id)
                        .await
                        .map_err(AuthzError::from)?;

                    authorizer
                        .revoke_infra_writer(grant.subject_id, grant.resource_id)
                        .await
                        .map_err(AuthzError::from)?;

                    authorizer
                        .revoke_infra_owner(grant.subject_id, grant.resource_id)
                        .await
                        .map_err(AuthzError::from)?;
                }
            }
        }
    }

    Ok(StatusCode::NO_CONTENT)
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
        let response: HashMap<String, Vec<ResourceGrant>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // Checks
        assert_eq!(response.contains_key("infra"), true);
        let infra_grants = response.get("infra").unwrap();
        assert_eq!(infra_grants.len(), 1);
        assert_eq!(
            infra_grants[0],
            ResourceGrant {
                resource_type: Resource::Infra,
                resource_id: infra.id,
                grant: InfraGrant::Owner
            }
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
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();
        let user_data = whoami(&app, &user);

        // Check that user is the owner of the infra via /authz/Infra/{infra_id}
        check_grant_on_resource(&app, &user, infra.id, user_data.id, Some(InfraGrant::Owner));

        // Create a new user and add it as a writer to the infra with the grant API
        let user_new = app.user("new", "New Authz").create();
        let user_new_data = whoami(&app, &user_new);
        let request_grant = app.post("/authz/grants").by_user(&user).json(&json!({
            "grant": [
                {
                    "subject_id": user_new_data.id,
                    "resource_type": Resource::Infra,
                    "resource_id": infra.id,
                    "grant": InfraGrant::Writer
                }
            ]
        }));
        app.fetch(request_grant)
            .assert_status(StatusCode::NO_CONTENT);
        // Check that the new user has the good grant
        check_grant_on_resource(
            &app,
            &user,
            infra.id,
            user_new_data.id,
            Some(InfraGrant::Writer),
        );

        // Remove the user from the API
        let request_revoke = app.post("/authz/grants").by_user(&user).json(&json!({
            "revoke": [
                {
                    "subject_id": user_new_data.id,
                    "resource_type": Resource::Infra,
                    "resource_id": infra.id
                }
            ]
        }));
        app.fetch(request_revoke)
            .assert_status(StatusCode::NO_CONTENT);
        // Check that the new user has the good grant
        check_grant_on_resource(&app, &user, infra.id, user_new_data.id, None);
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

        let user_data = whoami(&app, &user);

        // Adding OWNER on the same user/infra
        let request_revoke = app.post("/authz/grants").by_user(&user).json(&json!({
            "grant": [
                {
                    "subject_id": user_data.id,
                    "resource_type": Resource::Infra,
                    "resource_id": infra.id,
                    "grant": InfraGrant::Owner
                }
            ]
        }));
        app.fetch(request_revoke)
            .assert_status(StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn remove_a_grant_that_doesnt_exists() {
        let app = test_app!().enable_authorization(true).build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("authz", "Authz")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(infra.id, InfraGrant::Owner)
            .create();

        let user_new = app.user("new", "New Authz").create();
        let user_new_data = whoami(&app, &user_new);

        // Remove the READER grant should not fail
        let request_grant = app.post("/authz/grants").by_user(&user).json(&json!({
            "revoke": [
                {
                    "subject_id": user_new_data.id,
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

    fn whoami(app: &TestApp, user: &impl AsRef<UserInfo>) -> WhoamiResponse {
        let request = app.get("/authz/me").by_user(user);
        app.fetch(request).assert_status(StatusCode::OK).json_into()
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
