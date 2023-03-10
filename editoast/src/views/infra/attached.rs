use crate::error::Result;
use crate::infra::Infra;
use crate::infra_cache::InfraCache;
use crate::schema::ObjectType;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{block, Data, Json, Path};
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use std::collections::HashMap;
use thiserror::Error;

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

/// Return `/infra/<infra_id>/attached` routes
pub fn routes() -> impl HttpServiceFactory {
    attached
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "attached")]
enum AttachedError {
    #[error("Track '{track_id}' not found")]
    #[editoast_error(status = 404)]
    TrackNotFound { track_id: String },
}

/// This endpoint returns attached objects of given track
#[get("/attached/{track_id}")]
async fn attached(
    infra: Path<(i64, String)>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
) -> Result<Json<HashMap<ObjectType, Vec<String>>>> {
    let (infra, track_id) = infra.into_inner();

    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        let infra = Infra::retrieve_for_update(&mut conn, infra)?;
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
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
    })
    .await
    .unwrap()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};

    use crate::infra::Infra;
    use crate::schema::operation::RailjsonObject;
    use crate::schema::{Detector, OSRDIdentified, ObjectType, TrackSection};
    use crate::views::infra::tests::{
        create_infra_request, create_object_request, delete_infra_request,
    };
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn get_attached_detector() {
        let app = create_test_service().await;

        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_speed_tags_test")).await;

        // Create a track and a detector on it
        let track: RailjsonObject = TrackSection::default().into();
        let req = create_object_request(infra.id, track.clone());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);
        let req = create_object_request(
            infra.id,
            Detector {
                track: track.get_id().clone().into(),
                ..Default::default()
            }
            .into(),
        );
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/attached/{}/", infra.id, track.get_id()).as_str())
            .to_request();
        let response: HashMap<ObjectType, Vec<String>> = call_and_read_body_json(&app, req).await;
        assert_eq!(response.get(&ObjectType::Detector).unwrap().len(), 1);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
