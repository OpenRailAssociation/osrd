use std::ops::DerefMut;

use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json as WebJson;
use actix_web::web::Path;
use actix_web::web::Query;
use diesel::dsl::sql;
use diesel::pg::Pg;
use diesel::sql_types::Jsonb;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value as JsonValue;
use strum::VariantNames;
use thiserror::Error;

use crate::error::Result;
use crate::generated_data::infra_error::InfraErrorType;
use crate::modelsv2::pagination::load_for_pagination;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPoolV2;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;

/// Return `/infra/<infra_id>/errors` routes
pub fn routes() -> impl HttpServiceFactory {
    list_errors
}

#[derive(Debug, Clone, Deserialize)]
struct ErrorListQueryParams {
    #[serde(default)]
    level: Level,
    error_type: Option<String>,
    object_id: Option<String>,
}

#[derive(Serialize)]
struct ErrorListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<InfraError>,
}

/// Return the list of errors of an infra
#[get("/errors")]
async fn list_errors(
    db_pool: Data<DbConnectionPoolV2>,
    infra: Path<i64>,
    pagination_params: Query<PaginationQueryParam>,
    params: Query<ErrorListQueryParams>,
) -> Result<WebJson<ErrorListResponse>> {
    let (page, page_size) = pagination_params
        .validate(100)?
        .warn_page_size(100)
        .unpack();
    let (page, page_size) = (page as u64, page_size as u64);
    let infra = infra.into_inner();

    if let Some(error_type) = &params.error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }

    let (results, total_count) = get_paginated_infra_errors(
        db_pool.get().await?.deref_mut(),
        infra,
        page,
        page_size,
        params.into_inner(),
    )
    .await?;
    let stats = PaginationStats::new(results.len() as u64, total_count, page, page_size);
    Ok(WebJson(ErrorListResponse { stats, results }))
}

/// Check if the query parameter error_type exist
fn check_error_type_query(param: &String) -> bool {
    InfraErrorType::VARIANTS
        .iter()
        .any(|x| &x.to_string() == param)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:errors")]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfraError {
    #[diesel(sql_type = Jsonb)]
    pub information: JsonValue,
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

async fn get_paginated_infra_errors(
    conn: &mut DbConnection,
    infra: i64,
    page: u64,
    page_size: u64,
    params: ErrorListQueryParams,
) -> Result<(Vec<InfraError>, u64)> {
    use crate::tables::infra_layer_error::dsl;
    use crate::tables::infra_layer_error::table;
    use diesel::prelude::*;
    use diesel::sql_types::*;
    let ErrorListQueryParams {
        level,
        error_type,
        object_id,
    } = params;
    type Filter = Box<dyn BoxableExpression<table, Pg, SqlType = Bool>>;
    fn sql_true() -> Filter {
        Box::new(sql::<Bool>("TRUE"))
    }
    let level_filter: Filter = match level {
        Level::Warnings => Box::new(sql::<Text>("information->>'is_warning'").eq("true")),
        Level::Errors => Box::new(sql::<Text>("information->>'is_warning'").eq("false")),
        Level::All => sql_true(),
    };
    let error_type_filter: Filter = error_type
        .map(|ty| -> Filter { Box::new(sql::<Text>("information->>'error_type'").eq(ty)) })
        .unwrap_or_else(sql_true);
    let object_id_filter: Filter = object_id
        .map(|id| -> Filter { Box::new(sql::<Text>("information->>'obj_id'").eq(id)) })
        .unwrap_or_else(sql_true);
    let query = dsl::infra_layer_error
        .select(dsl::information)
        .filter(dsl::infra_id.eq(infra))
        .filter(level_filter)
        .filter(error_type_filter)
        .filter(object_id_filter);
    load_for_pagination(conn, query, page, page_size).await
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
    use crate::views::infra::errors::check_error_type_query;
    use crate::views::test_app::TestAppBuilder;

    #[test]
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

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
