use authz;
use authz::v2;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use schemas::infra::TrackSection;
use schemas::primitives::BoundingBox;
use thiserror::Error;

use crate::AppState;
use crate::authentication;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use models::Infra;
use models::TrackSectionModel;
use models::prelude::*;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:lines")]
enum LinesErrors {
    #[error("no line with code {line_code} found")]
    LineNotFound { line_code: i32 },
}

/// Returns the BBoxes of a line
#[editoast_derive::route]
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
pub(in crate::views) async fn get_line_bbox(
    Path((infra_id, line_code)): Path<(i64, i64)>,
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
) -> Result<Json<BoundingBox>> {
    let line_code: i32 = line_code.try_into().unwrap();

    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        v2::infra_privileges(*user, authz::Infra(infra_id))
            .map(async |privileges| privileges.contains(&authz::InfraPrivilege::CanRestrictedRead))
            .ok_or(AuthorizationError::Forbidden)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await??;
    }

    let mut bbox = BoundingBox::default();
    let selection_settings =
        SelectionSettings::new().filter(move || TrackSectionModel::INFRA_ID.eq(infra.id));
    let tracksections_model = TrackSectionModel::list(&mut conn, selection_settings).await?;
    let mut tracksections = tracksections_model
        .into_iter()
        .map(TrackSection::from)
        .filter(|track| track.extensions.sncf.as_ref().expect("track section extension 'sncf' is required for /infra/{id}/lines/{line_code}/bbox").line_code == line_code)
        .peekable();

    if tracksections.peek().is_none() {
        return Err(LinesErrors::LineNotFound { line_code }.into());
    }
    tracksections.for_each(|track| {
        bbox.union(&track.geo_bbox());
    });

    Ok(Json(bbox))
}

#[cfg(test)]
mod tests {
    use authz::InfraGrant;
    use geos::geojson::Geometry;
    use pretty_assertions::assert_eq;

    use schemas::infra::TrackSectionSncfExtension;
    use schemas::primitives::Identifier;
    use serde_json::json;
    use std::str::FromStr;

    use crate::fixtures::create_empty_infra;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use schemas::infra::TrackSection;
    use schemas::infra::TrackSectionExtensions;
    use schemas::primitives::BoundingBox;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn returns_correct_bbox_for_existing_line_code() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

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

        let bounding_box: BoundingBox = app
            .get(format!("/infra/{}/lines/{line_code}/bbox/", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            bounding_box,
            BoundingBox {
                min_lon: 1.,
                min_lat: 2.,
                max_lon: 3.,
                max_lat: 4.,
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn returns_bad_request_when_line_code_not_found() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let not_existing_line_code = 123456789;
        app.get(
            format!(
                "/infra/{}/lines/{not_existing_line_code}/bbox/",
                empty_infra.id
            )
            .as_str(),
        )
        .by_user(user.as_ref())
        .await
        .assert_status_bad_request();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_line_bbox_requires_can_read() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app.user("user", "User").create().await;

        app.get(format!("/infra/{}/lines/1/bbox/", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }
}
