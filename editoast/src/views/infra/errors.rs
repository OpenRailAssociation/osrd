use std::str::FromStr;
use std::sync::Arc;

use authz;
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

use crate::error::Result;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorTypeLabel;
use crate::models::Infra;
use crate::models::infra::errors::Level;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdParam;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use database::DbConnectionPoolV2;
use editoast_models::prelude::*;

use super::InfraApiError;

#[derive(Debug, Clone, Deserialize, utoipa::IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ErrorListQueryParams {
    /// Whether the response should include errors or warnings
    #[serde(default)]
    #[param(inline)]
    level: Level,
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Query(PaginationQueryParams { page, page_size }): Query<PaginationQueryParams<100>>,
    Query(ErrorListQueryParams {
        level,
        error_type,
        object_id,
    }): Query<ErrorListQueryParams>,
) -> Result<Json<ErrorListResponse>> {
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

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
        .get_paginated_errors(conn, Level::All, None, None, 1, 10000)
        .await
        .expect("errors should be fetched successfully")
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;

    use crate::models::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_errors_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let error_type = "overlapping_electrifications";
        let level = "warnings";

        let req = app.get(
            format!(
                "/infra/{}/errors?error_type={}&level={}",
                empty_infra.id, error_type, level
            )
            .as_str(),
        );
        app.fetch(req).await.assert_status(StatusCode::OK);
    }
}
