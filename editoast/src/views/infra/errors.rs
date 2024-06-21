use std::str::FromStr;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json as WebJson;
use actix_web::web::Path;
use actix_web::web::Query;
use editoast_derive::EditoastError;
use editoast_schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

use crate::error::Result;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorTypeLabel;
use crate::modelsv2::infra::errors::Level;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::infra::InfraIdParam;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use editoast_models::DbConnectionPoolV2;

use super::InfraApiError;

crate::routes! {
    list_errors,
}

#[derive(Debug, Clone, Deserialize, utoipa::IntoParams)]
#[into_params(parameter_in = Query)]
struct ErrorListQueryParams {
    /// Whether the response should include errors or warnings
    #[serde(default)]
    #[param(inline)]
    level: Level,
    /// The type of error to filter on
    #[param(value_type = Option<InfraErrorTypeLabel>)]
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
#[utoipa::path(
     tag = "infra",
     params(InfraIdParam, PaginationQueryParam, ErrorListQueryParams),
     responses(
         (status = 200, body = inline(ErrorListResponse), description = "A paginated list of errors"),
     ),
 )]
#[get("/errors")]
async fn list_errors(
    db_pool: Data<DbConnectionPoolV2>,
    infra: Path<InfraIdParam>,
    pagination_params: Query<PaginationQueryParam>,
    Query(ErrorListQueryParams {
        level,
        error_type,
        object_id,
    }): Query<ErrorListQueryParams>,
) -> Result<WebJson<ErrorListResponse>> {
    let (page, page_size) = pagination_params
        .validate(100)?
        .warn_page_size(100)
        .unpack();
    let (page, page_size) = (page as u64, page_size as u64);

    let error_type = match error_type.map(|et| InfraErrorTypeLabel::from_str(&et).ok()) {
        Some(None) => return Err(ListErrorsErrors::WrongErrorTypeProvided.into()),
        Some(et) => et,
        None => None,
    };

    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, infra.infra_id, || InfraApiError::NotFound {
        infra_id: infra.infra_id,
    })
    .await?;

    let (results, total_count) = infra
        .get_paginated_errors(conn, level, error_type, object_id, page, page_size)
        .await?;
    let results = results
        .into_iter()
        .map(|information| InfraErrorResponse { information })
        .collect::<Vec<_>>();
    let stats = PaginationStats::new(results.len() as u64, total_count, page, page_size);
    Ok(WebJson(ErrorListResponse { stats, results }))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:errors")]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

#[cfg(test)]
pub(in crate::views) async fn query_errors(
    conn: &mut editoast_models::DbConnection,
    infra: &Infra,
) -> (Vec<InfraError>, u64) {
    infra
        .get_paginated_errors(conn, Level::All, None, None, 1, 10000)
        .await
        .expect("errors should be fetched successfully")
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use std::ops::DerefMut;

    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn list_errors_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let error_type = "overlapping_electrifications";
        let level = "warnings";

        let req = TestRequest::get()
            .uri(
                format!(
                    "/infra/{}/errors?error_type={}&level={}",
                    empty_infra.id, error_type, level
                )
                .as_str(),
            )
            .to_request();
        let response = call_service(&app.service, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
