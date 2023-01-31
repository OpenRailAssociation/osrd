use crate::error::{EditoastError, Result};
use crate::schema::InfraErrorType;
use crate::views::pagination::{
    paginate, PaginatedResponse, PaginationError, PaginationQueryParam,
};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::http::StatusCode;
use actix_web::web::{block, Data, Json as WebJson, Path, Query};
use diesel::sql_types::{BigInt, Json, Nullable, Text};
use diesel::{PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use strum::VariantNames;
use thiserror::Error;

/// Return `/infra/<infra_id>/errors` routes
pub fn routes() -> impl HttpServiceFactory {
    list_errors
}

#[derive(Debug, Clone, Deserialize)]
struct QueryParams {
    #[serde(default)]
    level: Level,
    error_type: Option<String>,
    object_id: Option<String>,
}

/// Return the list of errors of an infra
#[get("/errors")]
async fn list_errors(
    db_pool: Data<DbPool>,
    infra: Path<i64>,
    pagination_params: Query<PaginationQueryParam>,
    params: Query<QueryParams>,
) -> Result<WebJson<PaginatedResponse<InfraErrorModel>>> {
    let infra = infra.into_inner();
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);

    if let Some(error_type) = &params.error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }

    let (infra_errors, count) = block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        get_paginated_infra_errors(&mut conn, infra, page, per_page, &params)
    })
    .await
    .unwrap()?;
    let previous = if page == 1 { None } else { Some(page - 1) };
    let max_page = (count as f64 / per_page as f64).ceil() as i64;
    let next = if page >= max_page {
        None
    } else {
        Some(page + 1)
    };
    Ok(WebJson(PaginatedResponse {
        count,
        previous,
        next,
        results: infra_errors,
    }))
}

/// Check if the query parameter error_type exist
fn check_error_type_query(param: &String) -> bool {
    InfraErrorType::VARIANTS
        .iter()
        .any(|x| &x.to_string() == param)
}

#[derive(Debug, Error)]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

impl EditoastError for ListErrorsErrors {
    fn get_status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }

    fn get_type(&self) -> &'static str {
        match self {
            ListErrorsErrors::WrongErrorTypeProvided => "editoast:infra:WrongErrorTypeProvided",
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
struct InfraErrorQueryable {
    #[diesel(sql_type = BigInt)]
    pub count: i64,
    #[diesel(sql_type = Json)]
    pub information: JsonValue,
    #[diesel(sql_type = Nullable<Json>)]
    pub geographic: Option<JsonValue>,
    #[diesel(sql_type = Nullable<Json>)]
    pub schematic: Option<JsonValue>,
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields)]
struct InfraErrorModel {
    pub information: JsonValue,
    pub geographic: Option<JsonValue>,
    pub schematic: Option<JsonValue>,
}

impl From<InfraErrorQueryable> for InfraErrorModel {
    fn from(error: InfraErrorQueryable) -> Self {
        Self {
            information: error.information,
            geographic: error.geographic,
            schematic: error.schematic,
        }
    }
}

fn get_paginated_infra_errors(
    conn: &mut PgConnection,
    infra: i64,
    page: i64,
    per_page: i64,
    params: &QueryParams,
) -> Result<(Vec<InfraErrorModel>, u64)> {
    let mut query =
        String::from("SELECT information::text, ST_AsGeoJSON(ST_Transform(geographic, 4326))::json as geographic,
        ST_AsGeoJSON(ST_Transform(schematic, 4326))::json as schematic FROM osrd_infra_errorlayer WHERE infra_id = $1");
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

    let infra_errors = paginate(query, page, per_page)
        .bind::<BigInt, _>(infra)
        .bind::<Text, _>(params.error_type.clone().unwrap_or_default())
        .bind::<Text, _>(params.object_id.clone().unwrap_or_default())
        .load::<InfraErrorQueryable>(conn)?;
    let count = infra_errors.first().map(|e| e.count).unwrap_or_default();
    let infra_errors: Vec<InfraErrorModel> = infra_errors.into_iter().map(|e| e.into()).collect();
    if infra_errors.is_empty() && page > 1 {
        return Err(PaginationError::InvalidPage.into());
    }
    Ok((infra_errors, count as u64))
}

#[cfg(test)]
mod tests {
    use crate::infra::Infra;
    use crate::views::infra::errors::check_error_type_query;
    use crate::views::tests::create_test_service;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};
    use serde_json::json;

    #[test]
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

    #[actix_test]
    async fn list_errors_get() {
        let error_type = "overlapping_track_links";
        let level = "warnings";

        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/infra")
            .set_json(json!({"name":"list_errors_test"}))
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;

        let req = TestRequest::get()
            .uri(
                format!(
                    "/infra/{}/errors?error_type={}&level={}",
                    infra.id, error_type, level
                )
                .as_str(),
            )
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete()
            .uri(format!("/infra/{}", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
