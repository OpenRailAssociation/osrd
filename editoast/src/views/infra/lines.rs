use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_schemas::primitives::BoundingBox;
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::models::prelude::*;
use crate::models::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;

crate::routes! {
    "/lines/{line_code}/bbox" => get_line_bbox,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:lines")]
enum LinesErrors {
    #[error("no line with code {line_code} found")]
    LineNotFound { line_code: i32 },
}

/// Returns the BBoxes of a line
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(
        InfraIdParam,
        ("line_code" = i64, Path, description = "A line code"),
    ),
    responses(
        (status = 200, body = BoundingBox, description = "The BBox of the line"),
    )
)]
async fn get_line_bbox(
    Path((infra_id, line_code)): Path<(i64, i64)>,
    State(AppState {
        infra_caches,
        db_pool_v2: db_pool,
        ..
    }): State<AppState>,
    Extension(authorizer): AuthorizerExt,
) -> Result<Json<BoundingBox>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let line_code: i32 = line_code.try_into().unwrap();

    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let mut bbox = BoundingBox::default();
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
        bbox.union(&track.bbox_geo);
    });

    Ok(Json(bbox))
}

#[cfg(test)]
mod test {
    use axum::http::StatusCode;
    use editoast_schemas::infra::TrackSectionSncfExtension;
    use editoast_schemas::primitives::Identifier;
    use geos::geojson::Geometry;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::str::FromStr;

    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::models::fixtures::create_empty_infra;
    use crate::views::test_app::TestAppBuilder;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::infra::TrackSectionExtensions;
    use editoast_schemas::primitives::BoundingBox;

    #[rstest]
    async fn returns_correct_bbox_for_existing_line_code() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

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
        apply_create_operation(&track_section, empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create track section object");

        let request =
            app.get(format!("/infra/{}/lines/{line_code}/bbox/", empty_infra.id).as_str());
        let bounding_box: BoundingBox =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(bounding_box, BoundingBox((1., 2.), (3., 4.)));
    }

    #[rstest]
    async fn returns_bad_request_when_line_code_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let not_existing_line_code = 123456789;
        let request = app.get(
            format!(
                "/infra/{}/lines/{not_existing_line_code}/bbox/",
                empty_infra.id
            )
            .as_str(),
        );
        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }
}
