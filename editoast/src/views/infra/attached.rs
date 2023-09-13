use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::Infra;
use crate::schema::ObjectType;
use crate::views::infra::InfraApiError;
use crate::{routes, schemas, DbPool};

use actix_web::get;
use actix_web::web::{Data, Json, Path};
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use serde_derive::Serialize;
use std::collections::HashMap;
use thiserror::Error;
use utoipa::ToSchema;

/// Objects types that can be attached to a track
const ATTACHED_OBJECTS_TYPES: &[ObjectType] = &[
    ObjectType::Signal,
    ObjectType::SpeedSection,
    ObjectType::Detector,
    ObjectType::TrackSectionLink,
    ObjectType::Switch,
    ObjectType::BufferStop,
    ObjectType::OperationalPoint,
    ObjectType::Catenary,
];

routes! {
    attached
}

schemas! {
    AttachedObjects,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "attached")]
enum AttachedError {
    #[error("Track '{track_id}' not found")]
    #[editoast_error(status = 404)]
    TrackNotFound { track_id: String },
}

/// Objects attached to a track section, grouped by type
#[derive(Serialize, ToSchema)]
struct AttachedObjects {
    #[serde(flatten)]
    #[schema(additional_properties = false, value_type = HashMap<ObjectType, Vec<String>>)]
    objects: HashMap<ObjectType, Vec<String>>,
}

/// Retrieve all objects attached to a given track
#[utoipa::path(
    params(super::InfraId),
    responses(
        (status = 200, body = AttachedObjects),
    )
)]
#[get("/attached/{track_id}")]
async fn attached(
    infra: Path<(i64, String)>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
) -> Result<Json<AttachedObjects>> {
    let (infra, track_id) = infra.into_inner();

    let mut conn = db_pool.get().await?;
    let infra = match Infra::retrieve_for_update(&mut conn, infra).await {
        Ok(infra) => infra,
        Err(_) => return Err(InfraApiError::NotFound { infra_id: infra }.into()),
    };
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
    Ok(Json(AttachedObjects { objects: res }))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_http::StatusCode;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};

    use crate::fixtures::tests::{empty_infra, TestFixture};
    use crate::models::Infra;
    use crate::schema::operation::RailjsonObject;
    use crate::schema::{Detector, OSRDIdentified, ObjectType, TrackSection};
    use crate::views::infra::tests::create_object_request;
    use crate::views::tests::create_test_service;
    use rstest::rstest;

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
