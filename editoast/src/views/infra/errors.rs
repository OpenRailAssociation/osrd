use crate::error::Result;
use crate::schema::InfraErrorType;
use crate::views::pagination::{Paginate, PaginatedResponse, PaginationQueryParam};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{Data, Json as WebJson, Path, Query};
use diesel::sql_query;
use diesel::sql_types::{BigInt, Json, Text};
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fmt::{Display, Formatter};
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
) -> Result<WebJson<PaginatedResponse<InfraError>>> {
    let (page, per_page) = pagination_params
        .validate(100)?
        .warn_page_size(100)
        .unpack();
    let infra = infra.into_inner();

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

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct InfraError {
    #[diesel(sql_type = Json)]
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

impl Display for Level {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Level::Warnings => write!(f, "warnings"),
            Level::Errors => write!(f, "errors"),
            Level::All => write!(f, "all"),
        }
    }
}

async fn get_paginated_infra_errors(
    db_pool: Data<DbPool>,
    infra: i64,
    page: i64,
    per_page: i64,
    params: &QueryParams,
) -> Result<PaginatedResponse<InfraError>> {
    let mut query =
        String::from("SELECT information::text FROM infra_layer_error WHERE infra_id = $1");
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
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::{Endpoint, InfraErrorType, ObjectRef, TrackSection};
    use crate::views::infra::errors::{check_error_type_query, InfraError, Level};
    use crate::views::pagination::PaginatedResponse;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    #[test]
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

    #[rstest]
    async fn list_errors_get(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;

        let error_type = InfraErrorType::OverlappingCatenaries {
            reference: ObjectRef::default(),
        };
        let level = Level::Warnings;

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

    #[rstest]
    async fn get_errors_must_return_buffer_stop_errors(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let track_section: RailjsonObject = TrackSection::default().into();
        let create_operation = Operation::Create(Box::new(track_section));
        let request = TestRequest::post()
            .uri(format!("/infra/{}/", empty_infra.id()).as_str())
            .set_json(json!([create_operation]))
            .to_request();
        call_service(&app, request).await;

        let error_type = InfraErrorType::MissingBufferStop {
            endpoint: Endpoint::Begin,
        };
        let level = Level::Warnings;
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
        let body: PaginatedResponse<InfraError> = read_body_json(response).await;
        assert_eq!(body.count, 2);
    }
}
