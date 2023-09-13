use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::infra::RAILJSON_VERSION;
use crate::models::{Infra, Retrieve};
use crate::schema::{ObjectType, RailJson};
use crate::views::infra::{InfraApiError, InfraForm};
use crate::{routes, DbPool};

use actix_web::http::header::ContentType;
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{get, post, HttpResponse, Responder};
use chashmap::CHashMap;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Text};
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
use enum_map::EnumMap;
use futures::future::try_join_all;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};

routes! {
    get_railjson,
    post_railjson
}

#[derive(QueryableByName, Default)]
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

/// Serializes an infra into RailJson
#[utoipa::path(
    params(super::InfraId),
    responses(
        (status = 200, description = "The infra as RailJson", body = RailJson),
    ),
)]
#[get("/{id}/railjson")]
async fn get_railjson(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<impl Responder> {
    let infra = infra.into_inner();
    let infra_meta = Infra::retrieve(db_pool.clone(), infra).await?.unwrap();

    let futures: Vec<_> = ObjectType::iter()
        .map(|object_type| (object_type, db_pool.get()))
        .map(|(object_type, conn_future)| async move {
            let mut conn = conn_future.await?;
            let table = object_type.get_table();
            let query =
                format!("SELECT (x.data)::text AS railjson FROM {table} x WHERE x.infra_id = $1");

            let result: Result<_> = Ok((
                object_type,
                sql_query(query)
                    .bind::<BigInt, _>(infra)
                    .load::<RailJsonData>(&mut conn)
                    .await?,
            ));
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
            "track_section_links": {track_section_links},
            "switches": {switches},
            "switch_types": {switch_types},
            "buffer_stops": {buffer_stops},
            "routes": {routes},
            "operational_points": {operational_points},
            "catenaries": {catenaries},
            "neutral_sections": {neutral_sections}
        }}"#,
        version = infra_meta.railjson_version.unwrap(),
        track_sections = res[ObjectType::TrackSection],
        signals = res[ObjectType::Signal],
        speed_sections = res[ObjectType::SpeedSection],
        detectors = res[ObjectType::Detector],
        track_section_links = res[ObjectType::TrackSectionLink],
        switches = res[ObjectType::Switch],
        switch_types = res[ObjectType::SwitchType],
        buffer_stops = res[ObjectType::BufferStop],
        routes = res[ObjectType::Route],
        operational_points = res[ObjectType::OperationalPoint],
        catenaries = res[ObjectType::Catenary],
        neutral_sections = res[ObjectType::NeutralSection]
    );

    Ok(HttpResponse::Ok()
        .content_type(ContentType::json())
        .append_header(("x-infra-version", infra_meta.version.unwrap()))
        .body(railjson))
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
struct PostRailjsonQueryParams {
    name: String,
    #[serde(default)]
    generate_data: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
struct PostRailjsonResponse {
    pub infra: i64,
}

/// Import an infra from a RailJson object
#[utoipa::path(
    params(PostRailjsonQueryParams),
    request_body = RailJson,
    responses(
        (status = 201, description = "The imported infra ID", body = inline(PostRailjsonResponse)),
    ),
)]
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

    let infra: Infra = InfraForm {
        name: params.name.clone(),
    }
    .into();
    let railjson = railjson.into_inner();
    let infra = infra.persist(railjson, db_pool.clone()).await?;
    let infra_id = infra.id.unwrap();

    let mut conn = db_pool.get().await?;
    let infra = infra
        .bump_version(&mut conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    if params.generate_data {
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
    }

    Ok(Json(PostRailjsonResponse {
        infra: infra.id.unwrap(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, read_body_json};

    use crate::fixtures::tests::{db_pool, empty_infra, TestFixture};
    use crate::models::Delete;
    use crate::schema::SwitchType;
    use crate::views::infra::tests::create_object_request;
    use crate::views::tests::create_test_service;
    use rstest::*;

    #[rstest]
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
        assert_eq!(railjson.version, crate::models::infra::RAILJSON_VERSION);
        assert_eq!(railjson.switch_types.len(), 1);
    }

    #[rstest]
    async fn test_post_railjson(db_pool: Data<DbPool>) {
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

        assert!(Infra::delete(db_pool, infra.infra).await.unwrap());
    }
}
