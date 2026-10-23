use authz::Role;
use authz::authorizers::SystemAuthorizer;
use authz::v2::group_members;
use authz::v2::user_groups;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use models::StdcmRequest;
use models::prelude::Changeset;
use models::prelude::Create as _;
use models::prelude::DeleteStatic as _;
use models::stdcm_request::PaginatedList;
use models::stdcm_request::SelectionSettings;
use reqwest::StatusCode;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::views::AuthorizationError;

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum IdentityFilter {
    Group,
    User,
}

#[derive(IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
pub struct PaginationQueryParams {
    after: Option<String>,
    limit: Option<usize>,
}

#[derive(IntoParams, Deserialize)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ListStdcmRequestQueryParams {
    #[param(inline)]
    by: Option<IdentityFilter>,
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(PartialEq, Deserialize))]
pub struct Links {
    next: Option<String>,
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(PartialEq, Deserialize))]
pub struct ListStdcmRequestResponse {
    #[schema(inline)]
    links: Links,
    requests: Vec<StdcmRequest>,
}

impl From<PaginatedList> for ListStdcmRequestResponse {
    fn from(list: PaginatedList) -> Self {
        ListStdcmRequestResponse {
            requests: list.requests,
            links: Links { next: list.next },
        }
    }
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "stdcm_request")]
pub enum StdcmRequestError {
    #[error("Invalid cursors in query parameters")]
    #[editoast_error(status = 422)]
    MalformedParameters(models::stdcm_request::DecodeError),
    #[error("Creating a request or listing by=group or by=user requires an authenticated user")]
    #[editoast_error(status = 401)]
    NotUser,
    #[error("Forbidden")]
    #[editoast_error(status = 403)]
    Forbidden,
    #[error("Not found")]
    #[editoast_error(status = 404)]
    NotFound,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(models::Error),
}

impl From<models::stdcm_request::Error> for StdcmRequestError {
    fn from(value: models::stdcm_request::Error) -> Self {
        match value {
            models::stdcm_request::Error::DecodeError(error) => {
                StdcmRequestError::MalformedParameters(error)
            }
            models::stdcm_request::Error::Database(error) => StdcmRequestError::Database(error),
        }
    }
}

/// Return a list of stdcm requests
#[editoast_derive::route(Role::Stdcm)]
#[utoipa::path(
    get, path = "",
    tag = "stdcm",
    params(ListStdcmRequestQueryParams, PaginationQueryParams),
    responses(
        (status = 200, body = ListStdcmRequestResponse, description = "List of stdcm requests"),
    )
)]
pub(in crate::views) async fn list(
    State(AppState {
        openfga, db_pool, ..
    }): State<AppState>,
    Query(list_stdcm_request_query_params): Query<ListStdcmRequestQueryParams>,
    Query(pagination_params): Query<PaginationQueryParams>,
    Extension(authn_state): Extension<crate::authentication::State>,
) -> Result<Json<ListStdcmRequestResponse>> {
    let mut settings = SelectionSettings::new();

    if let Some(size) = pagination_params.limit {
        settings = settings.limit(size)
    };
    if let Some(after) = pagination_params.after {
        settings = settings.cursor(after)
    };
    if let Some(user) = authn_state.user() {
        settings = match list_stdcm_request_query_params.by {
            Some(IdentityFilter::User) => settings.user_filter(vec![user.0]),
            Some(IdentityFilter::Group) => {
                let system = SystemAuthorizer::new_infallible(&openfga);
                let groups = user_groups(user)
                    .run::<AuthorizationError, _>(&system)
                    .await?;
                let mut same_group_user_ids = vec![];
                for group in groups {
                    same_group_user_ids.extend(
                        group_members(group)
                            .run::<AuthorizationError, _>(&system)
                            .await?
                            .into_iter()
                            .map(|user| user.0),
                    )
                }
                settings.user_filter(same_group_user_ids)
            }
            None if authn_state.roles().contains(&Role::Admin) => settings,
            None => return Err(StdcmRequestError::Forbidden.into()),
        };
    } else if list_stdcm_request_query_params.by.is_some() {
        return Err(StdcmRequestError::NotUser.into());
    }
    let settings = settings;

    let mut conn = db_pool.get().await?;
    let requests = StdcmRequest::list(&mut conn, settings)
        .await
        .map_err(StdcmRequestError::from)?
        .into();
    Ok(Json(requests))
}

#[derive(Deserialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Serialize))]
pub struct StdcmRequestForm {
    rmi_id: String,
    trace_id: Option<String>,
}

/// Create an stdcm request
#[editoast_derive::route(authz::Role::Stdcm)]
#[utoipa::path(
    post, path = "",
    tag = "stdcm",
    request_body = StdcmRequestForm,
    responses(
        (status = 201, body = StdcmRequest, description = "Stdcm request"),
    ),
)]
pub(in crate::views) async fn post(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Json(stdcm_request_create_form): Json<StdcmRequestForm>,
) -> Result<Json<StdcmRequest>> {
    match authn_state.user() {
        None => return Err(StdcmRequestError::NotUser.into()),
        Some(user) => {
            let stdcm_request = Changeset::<StdcmRequest>::default()
                .rmi_id(stdcm_request_create_form.rmi_id)
                .trace_id(stdcm_request_create_form.trace_id)
                .created_by(user.0)
                .create(&mut db_pool.get().await?)
                .await?;
            Ok(Json(stdcm_request))
        }
    }
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct StdcmRequestIdParam {
    id: i64,
}

/// Delete an stdcm request
#[editoast_derive::route(authz::Role::Admin)]
#[utoipa::path(
    delete, path = "",
    tag = "stdcm",
    params(StdcmRequestIdParam),
    responses(
        (status = 204, description = "The stdcm request was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(AppState { db_pool, .. }): State<AppState>,
    Path(StdcmRequestIdParam { id }): Path<StdcmRequestIdParam>,
) -> Result<impl IntoResponse> {
    StdcmRequest::delete_static_or_fail(&mut db_pool.get().await?, id, || {
        StdcmRequestError::NotFound
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
pub mod tests {
    use super::StdcmRequest;
    use crate::views::stdcm_request::Links;
    use crate::views::stdcm_request::ListStdcmRequestResponse;
    use crate::views::stdcm_request::StdcmRequestForm;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;
    use authz::Role;
    use database::DbConnection;
    use models::prelude::Changeset;
    use models::prelude::Create as _;

    async fn request_fixture(conn: &mut DbConnection, rmi_id: &str, user_id: i64) -> StdcmRequest {
        Changeset::<StdcmRequest>::default()
            .rmi_id(rmi_id.to_string())
            .created_by(user_id)
            .create(conn)
            .await
            .expect("Failed to create stdcm request")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_skip_authz_ok() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user = app.user("Alice", "Alice").create().await;
        let created_requests = vec![request_fixture(&mut conn, "Alice_req_1", user.id).await];
        let response = app
            .get("/stdcm_requests")
            .skip_authz()
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links { next: None },
            requests: created_requests,
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_admin_ok() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user1 = app
            .user("Alice", "Alice")
            .with_roles([Role::Admin])
            .create()
            .await;
        let user2 = app.user("Bob", "Bob").create().await;
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
        ];
        let response = app
            .get("/stdcm_requests")
            .by_user(user1.as_ref())
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links { next: None },
            requests: created_requests,
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_skip_authz_empty_ok() {
        let app = test_app!().build();
        let response = app
            .get("/stdcm_requests")
            .skip_authz()
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links { next: None },
            requests: vec![],
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_not_admin_forbidden() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        app.get("/stdcm_requests")
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let alice = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let bob = app.user("Bob", "Bob").create().await;
        let charlie = app.user("Charlie", "Charlie").create().await;
        // Add some groups to detect if the endpoint is not filtering by groups anyway
        app.group("g1")
            .with_members([&alice, &charlie])
            .create()
            .await;
        app.group("g2").with_members([&bob]).create().await;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", alice.id).await,
            request_fixture(&mut conn, "Bob_req_1", bob.id).await,
            request_fixture(&mut conn, "Charlie_req_1", charlie.id).await,
        ];
        let response = app
            .get("/stdcm_requests")
            .by_user(alice.as_ref())
            .add_query_param("by", "user")
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links { next: None },
            requests: vec![created_requests[0].clone()],
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_group() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user1 = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let user2 = app.user("Bob", "Bob").create().await;
        let user3 = app.user("Charlie", "Charlie").create().await;
        app.group("g1")
            .with_members([&user1, &user3])
            .create()
            .await;
        app.group("g2").with_members([&user2]).create().await;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
            request_fixture(&mut conn, "Charlie_req_1", user3.id).await,
        ];
        let response = app
            .get("/stdcm_requests")
            .by_user(user1.as_ref())
            .add_query_param("by", "group")
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links { next: None },
            requests: vec![created_requests[0].clone(), created_requests[2].clone()],
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user_skip_authz_unauthorized() {
        let app = test_app!().build();
        app.get("/stdcm_requests")
            .skip_authz()
            .add_query_param("by", "user")
            .await
            .assert_status_unauthorized();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_group_skip_authz_unauthorized() {
        let app = test_app!().build();
        app.get("/stdcm_requests")
            .skip_authz()
            .add_query_param("by", "group")
            .await
            .assert_status_unauthorized();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user_not_stdcm_forbidden() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        app.get("/stdcm_requests")
            .by_user(user.as_ref())
            .add_query_param("by", "user")
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_group_not_stdcm_forbidden() {
        let app = test_app!().build();
        let user = app.user("Alice", "Alice").create().await;
        app.get("/stdcm_requests")
            .by_user(user.as_ref())
            .add_query_param("by", "group")
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_ok() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user = app.user("Alice", "Alice").create().await;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user.id).await,
            request_fixture(&mut conn, "Alice_req_2", user.id).await,
            request_fixture(&mut conn, "Alice_req_3", user.id).await,
            request_fixture(&mut conn, "Alice_req_4", user.id).await,
        ];
        let preliminary_response_1: ListStdcmRequestResponse = app
            .get("/stdcm_requests")
            .skip_authz()
            .add_query_param("size", 3)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            preliminary_response_1.requests,
            vec![
                created_requests[0].clone(),
                created_requests[1].clone(),
                created_requests[2].clone()
            ]
        );
        let cursor_on_alice_req_3 = preliminary_response_1
            .links
            .next
            .expect("Next cursor should be present");
        let preliminary_response_2: ListStdcmRequestResponse = app
            .get("/stdcm_requests")
            .skip_authz()
            .add_query_param("after", &cursor_on_alice_req_3)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            preliminary_response_2.requests,
            vec![created_requests[3].clone()]
        );
        assert_eq!(preliminary_response_2.links.next, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_filtered_ok() {
        // The goal of the test is to check pagination of an page while filtering users
        // To obtain the appropriate cursor, we first need to perform a preliminary query
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user1 = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let user2 = app.user("Bob", "Bob").create().await;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Alice_req_2", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
            request_fixture(&mut conn, "Alice_req_3", user1.id).await,
            request_fixture(&mut conn, "Bob_req_2", user2.id).await,
        ];

        let preliminary_response_1: ListStdcmRequestResponse = app
            .get("/stdcm_requests")
            .skip_authz()
            .add_query_param("size", 1)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            preliminary_response_1.requests,
            vec![created_requests[0].clone()]
        );
        let cursor_on_alice_req_1 = preliminary_response_1
            .links
            .next
            .expect("Next cursor should be present");

        let response: ListStdcmRequestResponse = app
            .get("/stdcm_requests")
            .by_user(user1.as_ref())
            .add_query_param("after", cursor_on_alice_req_1)
            .add_query_param("by", "user")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            response.requests,
            vec![created_requests[1].clone(), created_requests[3].clone()]
        );
        assert_eq!(response.links.next, None);
        // Next cursor is None as while Bob_req_2 is after Alice_req_3 (created_requests[3]), it doesn't match the user
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn post_ok() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let response: StdcmRequest = app
            .post("/stdcm_requests")
            .json(&StdcmRequestForm {
                rmi_id: "Alice_req_1".to_string(),
                trace_id: Some("trace1".to_string()),
            })
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.rmi_id, "Alice_req_1".to_string());
        assert_eq!(response.trace_id, Some("trace1".to_string()));
        let requests_in_db = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .await
            .assert_status_ok()
            .json::<ListStdcmRequestResponse>()
            .requests;
        assert_eq!(requests_in_db.len(), 1);
        assert_eq!(response.rmi_id, "Alice_req_1".to_string());
        assert_eq!(response.trace_id, Some("trace1".to_string()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn post_no_user() {
        let app = test_app!().build();
        app.post("/stdcm_requests")
            .json(&StdcmRequestForm {
                rmi_id: "Alice_req_1".to_string(),
                trace_id: Some("trace1".to_string()),
            })
            .skip_authz()
            .await
            .assert_status_unauthorized();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn post_not_stdcm_forbidden() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        app.post("/stdcm_requests")
            .json(&StdcmRequestForm {
                rmi_id: "Alice_req_1".to_string(),
                trace_id: Some("trace1".to_string()),
            })
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_skip_authz_ok() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let created_request = request_fixture(&mut conn, "Alice_req_1", user.id).await;
        app.delete(&format!("/stdcm_requests/{}", created_request.id))
            .skip_authz()
            .await
            .assert_status_no_content();

        let requests_in_db = app
            .get("/stdcm_requests")
            .skip_authz()
            .await
            .assert_status_ok()
            .json::<ListStdcmRequestResponse>()
            .requests;
        assert!(requests_in_db.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_admin_ok() {
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Admin])
            .create()
            .await;
        let created_request = request_fixture(&mut conn, "Alice_req_1", user.id).await;
        app.delete(&format!("/stdcm_requests/{}", created_request.id))
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        let requests_in_db = app
            .get("/stdcm_requests")
            .skip_authz()
            .await
            .assert_status_ok()
            .json::<ListStdcmRequestResponse>()
            .requests;
        assert!(requests_in_db.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_not_found() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Admin])
            .create()
            .await;
        app.delete("/stdcm_requests/1")
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_not_admin_forbidden() {
        let app = test_app!().build();
        let user = app
            .user("Alice", "Alice")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        app.delete("/stdcm_requests/1")
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }
}
