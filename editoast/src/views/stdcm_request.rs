use authz::Role;
use authz::authorizers::SystemAuthorizer;
use authz::v2::group_members;
use authz::v2::user_groups;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Query;
use axum::extract::State;
use editoast_derive::EditoastError;
use models::StdcmRequest;
use models::stdcm_request::PaginatedList;
use models::stdcm_request::SelectionCursor;
use models::stdcm_request::SelectionSettings;
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
    before: Option<String>,
    size: Option<usize>,
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
    prev: Option<String>,
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
        use base64::prelude::*;
        ListStdcmRequestResponse {
            requests: list.requests,
            links: Links {
                prev: list.prev.map(|cursor| BASE64_URL_SAFE.encode(cursor)),
                next: list.next.map(|cursor| BASE64_URL_SAFE.encode(cursor)),
            },
        }
    }
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "stdcm_request")]
pub enum StdcmRequestError {
    #[error("Invalid cursors in query parameters")]
    #[editoast_error(status = 422)]
    MalformedParameters,
    #[error("Specifying both after and before cursor is not supported")]
    #[editoast_error(status = 400)]
    RangePaginationNotSupported,
    #[error("by=group and by=user query parameters require an authenticated user")]
    #[editoast_error(status = 401)]
    NotUser,
    #[error("Forbidden")]
    #[editoast_error(status = 403)]
    Forbidden,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(models::Error),
}

impl From<models::stdcm_request::Error> for StdcmRequestError {
    fn from(value: models::stdcm_request::Error) -> Self {
        match value {
            models::stdcm_request::Error::DecodeError(_) => StdcmRequestError::MalformedParameters,
            models::stdcm_request::Error::Database(error) => StdcmRequestError::Database(error),
        }
    }
}

impl From<base64::DecodeError> for StdcmRequestError {
    fn from(_value: base64::DecodeError) -> Self {
        StdcmRequestError::MalformedParameters
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
    use base64::prelude::*;
    let mut settings = SelectionSettings::new();
    if pagination_params.after.is_some() && pagination_params.before.is_some() {
        return Err(StdcmRequestError::RangePaginationNotSupported.into());
    }
    if let Some(size) = pagination_params.size {
        settings = settings.limit(size)
    };
    if let Some(after) = pagination_params.after {
        settings = settings.cursor(SelectionCursor::AfterCursor(
            BASE64_URL_SAFE
                .decode(after)
                .map_err(StdcmRequestError::from)?,
        ))
    };
    if let Some(before) = pagination_params.before {
        settings = settings.cursor(SelectionCursor::BeforeCursor(
            BASE64_URL_SAFE
                .decode(before)
                .map_err(StdcmRequestError::from)?,
        ))
    };
    if let Some(user) = authn_state.user() {
        match list_stdcm_request_query_params.by {
            Some(IdentityFilter::User) => settings = settings.user_filter(vec![user.0]),
            Some(IdentityFilter::Group) => {
                let system = SystemAuthorizer::new_infallible(&openfga);
                let groups = user_groups(user)
                    .run::<AuthorizationError, _>(&system)
                    .await?;
                let mut same_group_user_ids = vec![];
                for group in groups {
                    same_group_user_ids.extend(
                        (group_members(group))
                            .run::<AuthorizationError, _>(&system)
                            .await?
                            .into_iter()
                            .map(|user| user.0),
                    )
                }
                settings = settings.user_filter(same_group_user_ids)
            }
            None if authn_state.roles().contains(&Role::Admin) => (),
            None => return Err(StdcmRequestError::Forbidden.into()),
        }
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

#[cfg(test)]
pub mod tests {
    use super::StdcmRequest;
    use crate::views::stdcm_request::Links;
    use crate::views::stdcm_request::ListStdcmRequestResponse;
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
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: None,
                next: None,
            },
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
            .get(&format!("/stdcm_requests"))
            .by_user(user1.as_ref())
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: None,
                next: None,
            },
            requests: created_requests,
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_skip_authz_empty_ok() {
        let app = test_app!().build();
        let response = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: None,
                next: None,
            },
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
        app.get(&format!("/stdcm_requests"))
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user() {
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
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
            request_fixture(&mut conn, "Charlie_req_1", user3.id).await,
        ];
        let response = app
            .get(&format!("/stdcm_requests"))
            .by_user(user1.as_ref())
            .add_query_param("by", "user")
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: None,
                next: None,
            },
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
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
            request_fixture(&mut conn, "Charlie_req_1", user3.id).await,
        ];
        let response = app
            .get(&format!("/stdcm_requests"))
            .by_user(user1.as_ref())
            .add_query_param("by", "group")
            .await
            .assert_status_ok()
            .json();

        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: None,
                next: None,
            },
            requests: vec![created_requests[0].clone(), created_requests[2].clone()],
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user_skip_authz_unauthorized() {
        let app = test_app!().build();
        app.get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("by", "user")
            .await
            .assert_status_unauthorized();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_group_skip_authz_unauthorized() {
        let app = test_app!().build();
        app.get(&format!("/stdcm_requests"))
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
        app.get(&format!("/stdcm_requests"))
            .by_user(user.as_ref())
            .add_query_param("by", "user")
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_group_not_stdcm_forbidden() {
        let app = test_app!().build();
        let user = app.user("Alice", "Alice").create().await;
        app.get(&format!("/stdcm_requests"))
            .by_user(user.as_ref())
            .add_query_param("by", "group")
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_ok() {
        // The goal of the test is to check pagination of an intermediary page using a before cursor, as it is the most complex thus bug prone pagination case
        // It also incidentally tests extremities pages pagination as it is required to access and check the aforementioned intermediary pagination
        let app = test_app!().build();
        let mut conn = app.db_pool().get_ok();
        let user = app.user("Alice", "Alice").create().await;
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user.id).await,
            request_fixture(&mut conn, "Alice_req_2", user.id).await,
            request_fixture(&mut conn, "Alice_req_3", user.id).await,
            request_fixture(&mut conn, "Alice_req_4", user.id).await,
        ];
        // To obtain a cursor on the 4th request, we need to perform a couple of preliminary queries (as we need a page starting with the 4th request)
        // We need this cursor in order to build our aforementioned goal page
        let preliminary_response_1: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
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
        assert_eq!(preliminary_response_1.links.prev, None);
        let cursor_on_alice_req_3 = preliminary_response_1
            .links
            .next
            .expect("Next cursor should be present");
        let preliminary_response_2: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
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
        let cursor_on_alice_req_4 = preliminary_response_2
            .links
            .prev
            .expect("Prev cursor should be present");

        // The intermediary page being tested
        let response: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("before", &cursor_on_alice_req_4)
            .add_query_param("size", 2)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            response.requests,
            vec![created_requests[1].clone(), created_requests[2].clone()]
        );
        assert_eq!(response.links.next, Some(cursor_on_alice_req_3.clone()));
        let prev_cursor = response.links.prev.expect("Prev cursor should be present");

        // At this point we know that the returned next cursor is correct, as we can check it against an already known cursor on the 3rd request
        // However, we still need to check the returned prev cursor points to the second request, using a final follow up query
        let before_response: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("before", &prev_cursor)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(before_response.requests, vec![created_requests[0].clone()]);
        assert_eq!(before_response.links.prev, None);
        assert!(before_response.links.next.is_some());
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
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user1.id).await,
            request_fixture(&mut conn, "Alice_req_2", user1.id).await,
            request_fixture(&mut conn, "Bob_req_1", user2.id).await,
            request_fixture(&mut conn, "Alice_req_3", user1.id).await,
            request_fixture(&mut conn, "Bob_req_2", user2.id).await,
        ];

        let preliminary_response_1: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("size", 1)
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            preliminary_response_1.requests,
            vec![created_requests[0].clone()]
        );
        assert_eq!(preliminary_response_1.links.prev, None);
        let cursor_on_alice_req_1 = preliminary_response_1
            .links
            .next
            .expect("Next cursor should be present");

        let response: ListStdcmRequestResponse = app
            .get(&format!("/stdcm_requests"))
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
        assert!(response.links.prev.is_some());
        assert_eq!(response.links.next, None);
        // Next cursor is None as while Bob_req_2 is after Alice_req_3 (created_requests[3]), it doesn't match the user
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_range_pagination_not_supported() {
        let app = test_app!().build();
        app.get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("before", "placeholder")
            .add_query_param("after", "placeholder")
            .await
            .assert_status_bad_request();
    }
}
