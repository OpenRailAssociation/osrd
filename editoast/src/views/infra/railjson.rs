use crate::error::Result;
use crate::infra::RAILJSON_VERSION;
use crate::infra_cache::InfraCache;
use crate::schema::RailJson;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, Data, Json, Path, Query};
use actix_web::{get, post, services};
use chashmap::CHashMap;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel::{sql_query, RunQueryDsl};
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Return `/infra/<infra_id>/railjson` routes
pub fn routes() -> impl HttpServiceFactory {
    services![get_railjson, post_railjson]
}

#[derive(QueryableByName)]
struct RailJsonData {
    #[diesel(sql_type = Text)]
    railjson: String,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:railjson")]
enum ListErrorsRailjson {
    #[error("Wrong Railjson version provided")]
    WrongRailjsonVersionProvided,
}

#[derive(Debug, Clone, Copy, Deserialize)]
struct GetRailjsonQueryParam {
    #[serde(default)]
    exclude_extensions: bool,
}

/// Serialize an infra
#[get("/{infra}/railjson")]
async fn get_railjson(
    infra: Path<i64>,
    params: Query<GetRailjsonQueryParam>,
    db_pool: Data<DbPool>,
) -> Result<String> {
    let infra = infra.into_inner();
    let query = if params.exclude_extensions {
        include_str!("sql/get_infra_no_ext.sql")
    } else {
        include_str!("sql/get_infra_with_ext.sql")
    };
    let railjson: RailJsonData = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        sql_query(query)
            .bind::<BigInt, _>(infra)
            .get_result(&mut conn)
            .map_err(Into::into)
    })
    .await
    .unwrap()?;
    Ok(railjson.railjson)
}

#[derive(Debug, Clone, Deserialize)]
struct PostRailjsonQueryParams {
    name: String,
    #[serde(default)]
    generate_data: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct PostRailjsonResponse {
    pub infra: i64,
}

/// Import an infra
#[post("/railjson")]
async fn post_railjson(
    params: Query<PostRailjsonQueryParams>,
    railjson: Json<RailJson>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<PostRailjsonResponse>> {
    if railjson.version != RAILJSON_VERSION {
        return Err(ListErrorsRailjson::WrongRailjsonVersionProvided.into());
    }

    block(move || {
        let mut conn = db_pool.get()?;
        let infra = railjson.persist(&params.name, &mut conn)?;
        let infra = infra.bump_version(&mut conn)?;
        if params.generate_data {
            let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
            infra.refresh(&mut conn, true, &infra_cache)?;
        }

        Ok(Json(PostRailjsonResponse { infra: infra.id }))
    })
    .await
    .unwrap()
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, read_body_json};

    use crate::infra::Infra;
    use crate::schema::{RailJson, SwitchType};
    use crate::views::infra::railjson::PostRailjsonResponse;
    use crate::views::infra::tests::{
        create_infra_request, create_object_request, delete_infra_request,
    };
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn test_get_railjson() {
        let app = create_test_service().await;
        let req = create_infra_request("get_railjson_test");
        let infra: Infra = call_and_read_body_json(&app, req).await;

        let req = create_object_request(infra.id, SwitchType::default().into());
        let response = call_service(&app, req).await;
        assert!(response.status().is_success());

        let req = actix_test::TestRequest::get()
            .uri(&format!("/infra/{}/railjson", infra.id))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let railjson: RailJson = read_body_json(response).await;
        assert_eq!(railjson.version, crate::infra::RAILJSON_VERSION);
        assert_eq!(railjson.switch_types.len(), 1);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn test_post_railjson() {
        let app = create_test_service().await;

        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_section_links: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            catenaries: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            ..Default::default()
        };

        let req = actix_test::TestRequest::post()
            .uri("/infra/railjson?name=post_railjson_test")
            .set_json(&railjson)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let infra: PostRailjsonResponse = read_body_json(response).await;

        let response = call_service(&app, delete_infra_request(infra.infra)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
