use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json as WebJson;
use actix_web::web::Path;
use actix_web::web::Query;
use editoast_derive::EditoastError;
use std::ops::DerefMut;
use strum::VariantNames;
use thiserror::Error;

use crate::error::Result;
use crate::generated_data::infra_error::InfraErrorType;
use crate::modelsv2::infra::errors::InfraError;
use crate::modelsv2::infra::errors::QueryParams;
use crate::modelsv2::infra::Infra;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPoolV2;
use crate::views::infra::InfraApiError;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;

/// Return `/infra/<infra_id>/errors` routes
pub fn routes() -> impl HttpServiceFactory {
    list_errors
}

/// Return the list of errors of an infra
#[get("/errors")]
async fn list_errors(
    db_pool: Data<DbConnectionPoolV2>,
    infra: Path<i64>,
    pagination_params: Query<PaginationQueryParam>,
    params: Query<QueryParams>,
) -> Result<WebJson<PaginatedResponse<InfraError>>> {
    let (page, per_page) = pagination_params
        .validate(100)?
        .warn_page_size(100)
        .unpack();
    let infra_id = infra.into_inner();

    if let Some(error_type) = &params.error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }

    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let errors = infra
        .get_paginated_errors(db_pool.get().await?.deref_mut(), page, per_page, &params)
        .await?;
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
