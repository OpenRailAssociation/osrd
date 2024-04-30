use std::collections::HashMap;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use serde_derive::Deserialize;
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use editoast_schemas::primitives::ObjectType;

crate::routes! { attached }

/// Objects types that can be attached to a track
const ATTACHED_OBJECTS_TYPES: &[ObjectType] = &[
    ObjectType::Signal,
    ObjectType::SpeedSection,
    ObjectType::Detector,
    ObjectType::Switch,
    ObjectType::BufferStop,
    ObjectType::OperationalPoint,
    ObjectType::Electrification,
];

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "attached")]
enum AttachedError {
    #[error("Track '{track_id}' not found")]
    #[editoast_error(status = 404)]
    TrackNotFound { track_id: String },
}

#[derive(utoipa::IntoParams, Deserialize)]
struct InfraAttachedParams {
    /// An infra ID
    infra_id: i64,
    /// A track section ID
    track_id: String,
}

/// Retrieve all objects attached to a given track
#[utoipa::path(
    tag = "infra",
    params(InfraAttachedParams),
    responses(
        (
            status = 200,
            body = inline(HashMap<ObjectType, Vec<String>>),
            description = "All objects attached to the given track (arranged by types)"
        ),
    ),
)]
#[get("/attached/{track_id}")]
async fn attached(
    params: Path<InfraAttachedParams>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<HashMap<ObjectType, Vec<String>>>> {
    let InfraAttachedParams { infra_id, track_id } = params.into_inner();
    let mut conn = db_pool.get().await?;
    // TODO: lock for share
    let infra =
        Infra::retrieve_or_fail(&mut conn, infra_id, || InfraApiError::NotFound { infra_id })
            .await?;
    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    // Check track existence
    if !infra_cache.track_sections().contains_key(&track_id) {
        return Err(AttachedError::TrackNotFound {
            track_id: track_id.clone(),
        }
        .into());
    }
    // Get attached objects
    let res: HashMap<_, Vec<_>> = ATTACHED_OBJECTS_TYPES
        .iter()
        .map(|obj_type| {
            (
                *obj_type,
                infra_cache
                    .get_track_refs_type(&track_id, *obj_type)
                    .into_iter()
                    .map(|obj_ref| obj_ref.obj_id.clone())
                    .collect(),
            )
        })
        .collect();
    Ok(Json(res))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_http::StatusCode;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;

    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::infra_cache::operation::RailjsonObject;
    use crate::modelsv2::Infra;
    use crate::views::infra::tests::create_object_request;
    use crate::views::tests::create_test_service;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::primitives::OSRDIdentified;
    use editoast_schemas::primitives::ObjectType;

    #[rstest]
    async fn get_attached_detector(#[future] empty_infra: TestFixture<Infra>) {
        let app = create_test_service().await;
        let empty_infra = empty_infra.await;

        // Create a track and a detector on it
        let track: RailjsonObject = TrackSection::default().into();
        let req = create_object_request(empty_infra.id(), track.clone());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);
        let req = create_object_request(
            empty_infra.id(),
            Detector {
                track: track.get_id().clone().into(),
                ..Default::default()
            }
            .into(),
        );
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/attached/{}/", empty_infra.id(), track.get_id()).as_str())
            .to_request();
        let response: HashMap<ObjectType, Vec<String>> = call_and_read_body_json(&app, req).await;
        assert_eq!(response.get(&ObjectType::Detector).unwrap().len(), 1);
    }
}
