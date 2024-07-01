use actix_web::get;
use actix_web::http::header::ContentType;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use actix_web::Responder;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::RAILJSON_VERSION;
use enum_map::EnumMap;
use futures::future::try_join_all;
use serde::Deserialize;
use serde::Serialize;
use std::ops::DerefMut;
use strum::IntoEnumIterator;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use editoast_models::DbConnectionPool;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    get_railjson,
    post_railjson,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:railjson")]
enum ListErrorsRailjson {
    #[error("Wrong Railjson version provided")]
    WrongRailjsonVersionProvided,
}

/// Serialize an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200,  description = "The infra in railjson format", body = RailJson),
        (status = 404, description = "The infra was not found"),
    )
)]
#[get("/{infra_id}/railjson")]
async fn get_railjson(
    infra: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
) -> Result<impl Responder> {
    let infra_id = infra.infra_id;
    let conn = &mut db_pool.get().await?;
    let infra_meta =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;

    let futures: Vec<_> = ObjectType::iter()
        .map(|object_type| (object_type, db_pool.get()))
        .map(|(object_type, conn_future)| async move {
            let conn = &mut conn_future.await?;
            let railjson_data = Infra::get_railjson(conn, infra_id, &object_type).await?;
            let result: Result<_> = Ok((object_type, railjson_data));
            result
        })
        .collect();

    // TODO: we could map the objects in the async loop above, so we can start processing some objects
    // even if we didn’t get everything back yet
    let res: EnumMap<_, _> = try_join_all(futures)
        .await?
        .into_iter()
        .map(|(obj_type, objects)| {
            let obj_list = objects
                .into_iter()
                .map(|obj| obj.railjson)
                .collect::<Vec<_>>()
                .join(",");
            (obj_type, format!("[{obj_list}]"))
        })
        .collect();

    // Here we avoid the deserialization of the whole RailJson object
    let railjson = format!(
        r#"{{
            "version": "{version}",
            "track_sections": {track_sections},
            "signals": {signals},
            "speed_sections": {speed_sections},
            "detectors": {detectors},
            "switches": {switches},
            "extended_switch_types": {switch_types},
            "buffer_stops": {buffer_stops},
            "routes": {routes},
            "operational_points": {operational_points},
            "electrifications": {electrifications},
            "neutral_sections": {neutral_sections}
        }}"#,
        version = infra_meta.railjson_version,
        track_sections = res[ObjectType::TrackSection],
        signals = res[ObjectType::Signal],
        speed_sections = res[ObjectType::SpeedSection],
        detectors = res[ObjectType::Detector],
        switches = res[ObjectType::Switch],
        switch_types = res[ObjectType::SwitchType],
        buffer_stops = res[ObjectType::BufferStop],
        routes = res[ObjectType::Route],
        operational_points = res[ObjectType::OperationalPoint],
        electrifications = res[ObjectType::Electrification],
        neutral_sections = res[ObjectType::NeutralSection]
    );

    Ok(HttpResponse::Ok()
        .content_type(ContentType::json())
        .append_header(("x-infra-version", infra_meta.version))
        .body(railjson))
}

/// Represents the query parameters for a `POST /infra/railjson` request
#[derive(Debug, Clone, Deserialize, IntoParams)]
struct PostRailjsonQueryParams {
    /// The name of the infrastructure.
    name: String,
    /// Flag indicating whether to generate data.
    #[serde(default)]
    generate_data: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
struct PostRailjsonResponse {
    pub infra: i64,
}

/// Import an infra from railjson
#[utoipa::path(
    tag = "infra",
    params(PostRailjsonQueryParams),
    request_body = RailJson,
    responses(
        (status = 201,  description = "The imported infra id", body = inline(PostRailjsonResponse)),
        (status = 404, description = "The infra was not found"),
    )
)]
#[post("/railjson")]
async fn post_railjson(
    params: Query<PostRailjsonQueryParams>,
    railjson: Json<RailJson>,
    db_pool: Data<DbConnectionPoolV2>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<PostRailjsonResponse>> {
    if railjson.version != RAILJSON_VERSION {
        return Err(ListErrorsRailjson::WrongRailjsonVersionProvided.into());
    }
    let railjson = railjson.into_inner();

    let db_pool = db_pool.into_inner();
    let mut infra = Infra::changeset()
        .name(params.name.clone())
        .last_railjson_version()
        .persist_v2(railjson, db_pool.clone())
        .await?;
    let infra_id = infra.id;

    infra
        .bump_version(db_pool.get().await?.deref_mut())
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    if params.generate_data {
        let infra_cache =
            InfraCache::get_or_load(db_pool.get().await?.deref_mut(), &infra_caches, &infra)
                .await?;
        infra.refresh_v2(db_pool, true, &infra_cache).await?;
    }

    Ok(Json(PostRailjsonResponse { infra: infra.id }))
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::views::infra::tests::create_object_request;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::tests::create_test_service;
    use editoast_schemas::infra::SwitchType;

    #[rstest]
    #[serial_test::serial]
    async fn test_get_railjson(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = create_object_request(empty_infra.id(), SwitchType::default().into());
        let response = call_service(&app, req).await;
        assert!(response.status().is_success());

        let req = actix_test::TestRequest::get()
            .uri(&format!("/infra/{}/railjson", empty_infra.id()))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let railjson: RailJson = read_body_json(response).await;
        assert_eq!(railjson.version, RAILJSON_VERSION);
        assert_eq!(railjson.extended_switch_types.len(), 1);
    }

    #[rstest]
    #[serial_test::serial]
    async fn test_post_railjson() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            extended_switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            electrifications: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            ..Default::default()
        };

        let req = actix_test::TestRequest::post()
            .uri("/infra/railjson?name=post_railjson_test")
            .set_json(&railjson)
            .to_request();

        let res: PostRailjsonResponse = app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert!(
            Infra::delete_static(db_pool.get_ok().deref_mut(), res.infra)
                .await
                .unwrap()
        );
    }
}
