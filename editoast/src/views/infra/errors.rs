use std::str::FromStr;

use authz;
use authz::v2;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use editoast_derive::EditoastError;
use schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

use crate::AppState;
use crate::authentication;
use crate::error::Result;
use crate::generated_data::InfraErrorLevel;
use crate::generated_data::InfraGeneratedData as _;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorTypeLabel;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdParam;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use models::Infra;
use models::prelude::*;

use super::InfraApiError;

#[derive(Debug, Clone, Deserialize, utoipa::IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ErrorListQueryParams {
    /// Whether the response should include errors or warnings
    #[serde(default)]
    #[param(inline)]
    level: InfraErrorLevel,
    /// The type of error to filter on
    #[param(value_type = Option<InfraErrorTypeLabel>, inline)]
    error_type: Option<String>,
    /// Filter errors and warnings related to a given object
    #[param(value_type = Option<String>)]
    object_id: Option<Identifier>,
}

#[derive(Serialize, utoipa::ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct ErrorListResponse {
    #[serde(flatten)]
    pub(in crate::views) stats: PaginationStats,
    #[schema(inline)]
    pub(in crate::views) results: Vec<InfraErrorResponse>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct InfraErrorResponse {
    pub(in crate::views) information: InfraError,
}

/// A paginated list of errors related to an infra
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
     tag = "infra",
     params(InfraIdParam, PaginationQueryParams<100>, ErrorListQueryParams),
     responses(
         (status = 200, body = inline(ErrorListResponse), description = "A paginated list of errors"),
     ),
 )]
pub(in crate::views) async fn list_errors(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<100>>,
    Query(ErrorListQueryParams {
        level,
        error_type,
        object_id,
    }): Query<ErrorListQueryParams>,
    Extension(authn_state): Extension<authentication::State>,
) -> Result<Json<ErrorListResponse>> {
    let error_type = match error_type.map(|et| InfraErrorTypeLabel::from_str(&et).ok()) {
        Some(None) => return Err(ListErrorsErrors::WrongErrorTypeProvided.into()),
        Some(et) => et,
        None => None,
    };

    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        v2::infra_privileges(*user, authz::Infra(infra_id))
            .map(async |privileges| privileges.contains(&authz::InfraPrivilege::CanRestrictedRead))
            .ok_or(AuthorizationError::Forbidden)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await??;
    }

    let (results, total_count) = infra
        .get_paginated_errors(&mut conn, level, error_type, object_id, page, page_size)
        .await?;
    let results = results
        .into_iter()
        .map(|information| InfraErrorResponse { information })
        .collect::<Vec<_>>();
    let stats = PaginationStats::new(results.len() as u64, total_count, page, page_size);
    Ok(Json(ErrorListResponse { stats, results }))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:errors")]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

#[cfg(test)]
pub(in crate::views) async fn query_errors(
    conn: &mut database::DbConnection,
    infra: &Infra,
) -> (Vec<InfraError>, u64) {
    infra
        .get_paginated_errors(conn, InfraErrorLevel::All, None, None, 1, 10000)
        .await
        .expect("errors should be fetched successfully")
}

#[cfg(test)]
mod tests {

    use crate::fixtures::create_empty_infra;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use authz::InfraGrant;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_errors_get() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let error_type = "overlapping_electrifications";
        let level = "warnings";

        app.get(
            format!(
                "/infra/{}/errors?error_type={}&level={}",
                empty_infra.id, error_type, level
            )
            .as_str(),
        )
        .by_user(user.as_ref())
        .await
        .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_errors_requires_can_read() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app.user("user", "User").create().await;

        app.get(format!("/infra/{}/errors", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }
}
