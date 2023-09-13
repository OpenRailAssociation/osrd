use crate::error::Result;
use crate::schema::InfraErrorType;
use crate::views::pagination::{Paginate, PaginatedResponse, PaginationQueryParam};
use crate::{schemas, DbPool};
use actix_web::get;
use actix_web::web::{Data, Json as WebJson, Path, Query};
use diesel::sql_query;
use diesel::sql_types::{BigInt, Json, Nullable, Text};
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use strum::VariantNames;
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};

use crate::routes;

routes! {
    list_errors
}

schemas! {
    InfraError,
    Level,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
struct QueryParams {
    #[serde(default)]
    level: Level,
    error_type: Option<String>,
    object_id: Option<String>,
}

/// Return the list of errors of an infra
#[utoipa::path(
    params(super::InfraId, QueryParams, PaginationQueryParam),
    responses(
        (status = 200, description = "The list of errors of an infra", body = PaginatedInfraErrors)
    ),
)]
#[get("/errors")]
async fn list_errors(
    db_pool: Data<DbPool>,
    infra: Path<i64>,
    pagination_params: Query<PaginationQueryParam>,
    params: Query<QueryParams>,
) -> Result<WebJson<PaginatedResponse<InfraError>>> {
    let infra = infra.into_inner();
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);

    if let Some(error_type) = &params.error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }

    let errors = get_paginated_infra_errors(db_pool, infra, page, per_page, &params).await?;
    Ok(WebJson(errors))
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

#[derive(QueryableByName, Debug, Clone, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct InfraError {
    #[diesel(sql_type = Json)]
    #[schema(value_type = Value)]
    pub information: JsonValue,
    #[diesel(sql_type = Nullable<Json>)]
    #[schema(value_type = Value, nullable = true)]
    pub geographic: Option<JsonValue>,
    #[diesel(sql_type = Nullable<Json>)]
    #[schema(value_type = Value, nullable = true)]
    pub schematic: Option<JsonValue>,
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

async fn get_paginated_infra_errors(
    db_pool: Data<DbPool>,
    infra: i64,
    page: i64,
    per_page: i64,
    params: &QueryParams,
) -> Result<PaginatedResponse<InfraError>> {
    let mut query =
        String::from("SELECT information::text, ST_AsGeoJSON(ST_Transform(geographic, 4326))::json as geographic,
        ST_AsGeoJSON(ST_Transform(schematic, 4326))::json as schematic FROM infra_layer_error WHERE infra_id = $1");
    if params.level == Level::Warnings {
        query += " AND information->>'is_warning' = 'true'"
    } else if params.level == Level::Errors {
        query += " AND information->>'is_warning' = 'false'"
    }
    if params.error_type.is_some() {
        query += " AND information->>'error_type' = $2"
    }
    if params.object_id.is_some() {
        query += " AND information->>'obj_id' = $3"
    }
    let error_type = params.error_type.clone().unwrap_or_default();
    let object_id = params.object_id.clone().unwrap_or_default();
    let mut conn = db_pool.get().await?;
    sql_query(query)
        .bind::<BigInt, _>(infra)
        .bind::<Text, _>(error_type)
        .bind::<Text, _>(object_id)
        .paginate(page, per_page)
        .load_and_count::<InfraError>(&mut conn)
        .await
}

#[cfg(test)]
mod tests {
    use crate::fixtures::tests::{empty_infra, TestFixture};
    use crate::models::Infra;
    use crate::views::infra::errors::check_error_type_query;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test::{call_service, TestRequest};
    use rstest::rstest;

    #[test]
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

    #[rstest]
    async fn list_errors_get(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;

        let error_type = "overlapping_track_links";
        let level = "warnings";

        let app = create_test_service().await;

        let req = TestRequest::get()
            .uri(
                format!(
                    "/infra/{}/errors?error_type={}&level={}",
                    empty_infra.id(),
                    error_type,
                    level
                )
                .as_str(),
            )
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
