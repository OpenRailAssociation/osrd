use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use editoast_schemas::primitives::BoundingBox;
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;

crate::routes! {
    "/lines/{line_code}/bbox" => {
        get_line_bbox,
    },
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:lines")]
enum LinesErrors {
    #[error("no line with code {line_code} found")]
    LineNotFound { line_code: i32 },
}

/// Returns the BBoxes of a line
#[utoipa::path(
    tag = "infra",
    params(
        InfraIdParam,
        ("line_code" = i64, Path, description = "A line code"),
    ),
    responses(
        (status = 200, body = BoundingBox, description = "The BBox of the line"),
    )
)]
#[get("")]
async fn get_line_bbox(
    path: Path<(i64, i64)>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<BoundingBox>> {
    let (infra_id, line_code) = path.into_inner();
    let line_code: i32 = line_code.try_into().unwrap();

    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let mut zone = BoundingBox::default();
    let mut tracksections = infra_cache
        .track_sections()
        .values()
        .map(ObjectCache::unwrap_track_section)
        .filter(|track| track.line_code.map_or(false, |code| code == line_code))
        .peekable();
    if tracksections.peek().is_none() {
        return Err(LinesErrors::LineNotFound { line_code }.into());
    }
    tracksections.for_each(|track| {
        zone.union(&track.bbox_geo);
    });

    Ok(Json(zone))
}

#[cfg(test)]
mod test {
    use actix_web::http::StatusCode;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use editoast_schemas::infra::TrackSectionSncfExtension;
    use editoast_schemas::primitives::Identifier;
    use geos::geojson::Geometry;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::str::FromStr;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::infra_cache::operation::create::apply_create_operation;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::infra::TrackSectionExtensions;
    // use crate::modelsv2::fixtures::create_empty_infra;
    // use crate::views::test_app::TestAppBuilder;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn returns_correct_bbox_for_existing_line_code(
        #[future] empty_infra: TestFixture<Infra>,
    ) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let line_code = 1234;
        let geometry_json = json!({
            "type": "LineString",
            "coordinates": [[1., 2.], [3., 4.]]
        })
        .to_string();
        let track_section = TrackSection {
            id: Identifier::from("track_section_id"),
            extensions: TrackSectionExtensions {
                sncf: Some(TrackSectionSncfExtension {
                    line_code,
                    ..Default::default()
                }),
                ..Default::default()
            },
            geo: Geometry::from_str(&geometry_json).unwrap(),
            ..Default::default()
        }
        .into();
        apply_create_operation(
            &track_section,
            empty_infra.id,
            &mut db_pool().get().await.unwrap(),
        )
        .await
        .expect("Failed to create track section object");

        let req = TestRequest::get()
            .uri(format!("/infra/{}/lines/{line_code}/bbox/", empty_infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let bounding_box: BoundingBox = read_body_json(response).await;
        assert_eq!(bounding_box, BoundingBox((1., 2.), (3., 4.)));
    }

    #[rstest]
    async fn returns_400_when_line_code_not_found(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;
        let not_existing_line_code = 123456789;
        let req = TestRequest::get()
            .uri(
                format!(
                    "/infra/{}/lines/{not_existing_line_code}/bbox/",
                    empty_infra.id
                )
                .as_str(),
            )
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
