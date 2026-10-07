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
        ListStdcmRequestResponse {
            requests: list.requests,
            links: Links {
                prev: list.prev.map(|cursor| cursor.to_string()),
                next: list.next.map(|cursor| cursor.to_string()),
            },
        }
    }
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "stdcm_request")]
pub enum StdcmRequestError {
    #[error("Malformed parameters")]
    #[editoast_error(status = 400)]
    MalformedParameters,
    #[error("Specifying both after and before cursor is not supported")]
    #[editoast_error(status = 400)]
    RangePaginationNotSupported,
    #[error("Endpoint requires user authentication and is not available to backend services")]
    #[editoast_error(status = 401)]
    NotUser,
    #[error("Endpoint only available to backend services")]
    #[editoast_error(status = 403)]
    Forbidden,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(models::Error, database::DatabaseError)]
    Database(models::Error),
}

/// Return a list of stdcm requests
#[editoast_derive::route(Role::Stdcm)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
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
    if pagination_params.after.is_some() && pagination_params.before.is_some() {
        return Err(StdcmRequestError::RangePaginationNotSupported.into());
    }
    if let Some(size) = pagination_params.size {
        settings = settings.limit(size)
    };
    if let Some(after) = pagination_params.after {
        settings = settings.cursor(SelectionCursor::AfterCursor(
            after
                .parse::<i64>()
                .map_err(|_| StdcmRequestError::MalformedParameters)?,
        ))
    };
    if let Some(before) = pagination_params.before {
        settings = settings.cursor(SelectionCursor::BeforeCursor(
            before
                .parse::<i64>()
                .map_err(|_| StdcmRequestError::MalformedParameters)?,
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
    Ok(Json(StdcmRequest::list(&mut conn, settings).await?.into()))
}

#[cfg(test)]
pub mod tests {
    use super::StdcmRequest;
    use crate::views::{
        stdcm_request::{Links, ListStdcmRequestResponse},
        test_app::{TestRequestExt as _, test_app},
    };
    use authz::Role;
    use database::DbConnectionPoolV2;
    use models::prelude::{Changeset, Create as _};

    async fn request_fixture(
        db_pool: &DbConnectionPoolV2,
        rmi_id: &str,
        user_id: i64,
    ) -> StdcmRequest {
        Changeset::<StdcmRequest>::default()
            .rmi_id(rmi_id.to_string())
            .created_by(user_id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create stdcm request")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_all_skip_authz_ok() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app.user("1", "1").create().await;
        let created_requests = vec![request_fixture(&db_pool, "1_1", user.id).await];
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
        let db_pool = app.db_pool();
        let user1 = app.user("1", "1").with_roles([Role::Admin]).create().await;
        let user2 = app.user("2", "2").create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user1.id).await,
            request_fixture(&db_pool, "2_1", user2.id).await,
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
        let user = app.user("1", "1").with_roles([Role::Stdcm]).create().await;
        app.get(&format!("/stdcm_requests"))
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_by_user() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user1 = app.user("1", "1").with_roles([Role::Stdcm]).create().await;
        let user2 = app.user("2", "2").create().await;
        let user3 = app.user("3", "3").create().await;
        app.group("g1")
            .with_members([&user1, &user3])
            .create()
            .await;
        app.group("g2").with_members([&user2]).create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user1.id).await,
            request_fixture(&db_pool, "2_1", user2.id).await,
            request_fixture(&db_pool, "3_1", user3.id).await,
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
        let db_pool = app.db_pool();
        let user1 = app.user("1", "1").with_roles([Role::Stdcm]).create().await;
        let user2 = app.user("2", "2").create().await;
        let user3 = app.user("3", "3").create().await;
        app.group("g1")
            .with_members([&user1, &user3])
            .create()
            .await;
        app.group("g2").with_members([&user2]).create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user1.id).await,
            request_fixture(&db_pool, "2_1", user2.id).await,
            request_fixture(&db_pool, "3_1", user3.id).await,
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
            .user("1", "1")
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
        let user = app.user("1", "1").create().await;
        app.get(&format!("/stdcm_requests"))
            .by_user(user.as_ref())
            .add_query_param("by", "group")
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_before_ok() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app.user("1", "1").create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user.id).await,
            request_fixture(&db_pool, "1_2", user.id).await,
            request_fixture(&db_pool, "1_3", user.id).await,
            request_fixture(&db_pool, "1_4", user.id).await,
        ];
        let response = app
            .get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("before", created_requests[3].id)
            .add_query_param("size", 2)
            .await
            .assert_status_ok()
            .json();

        let expected_stdcm_requests =
            vec![created_requests[1].clone(), created_requests[2].clone()];
        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: Some(expected_stdcm_requests[0].id.to_string()),
                next: Some(expected_stdcm_requests[1].id.to_string()),
            },
            requests: expected_stdcm_requests,
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_after_ok() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user1 = app.user("1", "1").with_roles([Role::Stdcm]).create().await;
        let user2 = app.user("2", "2").create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user1.id).await,
            request_fixture(&db_pool, "1_2", user1.id).await,
            request_fixture(&db_pool, "2_1", user2.id).await,
            request_fixture(&db_pool, "1_3", user1.id).await,
            request_fixture(&db_pool, "2_2", user2.id).await,
        ];
        let response = app
            .get(&format!("/stdcm_requests"))
            .by_user(user1.as_ref())
            .add_query_param("after", created_requests[0].id)
            .add_query_param("by", "user")
            .await
            .assert_status_ok()
            .json();

        let expected_stdcm_requests =
            vec![created_requests[1].clone(), created_requests[3].clone()];
        let expected_response = ListStdcmRequestResponse {
            links: Links {
                prev: Some(expected_stdcm_requests[0].id.to_string()),
                next: None,
            },
            requests: expected_stdcm_requests,
        };
        assert_eq!(expected_response, response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_range_pagination_not_supported() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app.user("1", "1").create().await;
        let created_requests = vec![
            request_fixture(&db_pool, "1_1", user.id).await,
            request_fixture(&db_pool, "1_2", user.id).await,
        ];
        app.get(&format!("/stdcm_requests"))
            .skip_authz()
            .add_query_param("before", created_requests[0].id)
            .add_query_param("after", created_requests[1].id)
            .await
            .assert_status_bad_request();
    }
}
