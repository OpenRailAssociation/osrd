use std::collections::hash_map::Entry;
use std::collections::HashMap;

use crate::error::{InternalError, Result};
use crate::generated_data::generate_infra_errors;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::models::{self, Infra, Retrieve};
use crate::schema::operation::{CacheOperation, DeleteOperation, Operation, RailjsonObject};
use crate::schema::{InfraError, OSRDObject, ObjectRef, ObjectType};
use crate::views::infra::InfraIdParam;
use crate::DbPool;
use actix_web::get;
use actix_web::web::{Data, Json as WebJson, Path};
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use itertools::Itertools as _;
use log::{debug, error};
use thiserror::Error;

mod buffer_stop;
mod detector;
mod electrifications;
mod operational_point;
mod route;
mod signal;
mod speed_section;
mod switch;
mod track_section;

const MAX_AUTO_FIXES_ITERATIONS: u8 = 5;

type Fix = (Operation, CacheOperation);

fn new_ref_fix_delete_pair(object: &impl OSRDObject) -> (ObjectRef, Fix) {
    let operation = Operation::Delete(DeleteOperation::from(object.get_ref()));
    let cache_operation = CacheOperation::Delete(object.get_ref());
    (object.get_ref(), (operation, cache_operation))
}

fn new_ref_fix_create_pair(object: RailjsonObject) -> (ObjectRef, Fix) {
    let object_ref = object.get_ref();
    let operation = Operation::Create(Box::new(object.clone()));
    let cache_operation = CacheOperation::Create(ObjectCache::from(object));
    (object_ref, (operation, cache_operation))
}

// Return `/infra/<infra_id>/auto_fixes` routes
crate::routes! {
    "/auto_fixes" => {
        list_auto_fixes,
    },
}

/// Retrieve a list of operations to fix infra issues
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "The list of suggested operations", body = Vec<Operation>)
    )
)]
#[get("")]
async fn list_auto_fixes(
    infra: Path<i64>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
) -> Result<WebJson<Vec<Operation>>> {
    let infra_id = infra.into_inner();
    let infra = Infra::retrieve(db_pool.clone(), infra_id)
        .await?
        .ok_or(models::infra::InfraError::NotFound(infra_id))?;
    let mut conn = db_pool.get().await?;

    // accepting the early release of ReadGuard as it's anyway released when sending the suggestions (so before edit)
    let mut infra_cache_clone = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)
        .await?
        .clone();

    let mut fixes = vec![];
    for _ in 0..MAX_AUTO_FIXES_ITERATIONS {
        let infra_errors = generate_infra_errors(&infra_cache_clone).await;
        let new_fixes = fix_infra(&mut infra_cache_clone, infra_errors)?;
        if new_fixes.is_empty() {
            // Every possible error is fixed
            return Ok(WebJson(fixes));
        }
        fixes.extend(new_fixes);
    }

    // Reapplying an auto-fix should do nothing.
    // And few iterations are supposed to provide every possible fix.
    // Yet after reaching the maximum number of iterations, there are still fixes available.
    Err(AutoFixesEditoastError::MaximumIterationReached.into())
}

fn fix_infra(
    infra_cache: &mut InfraCache,
    infra_errors: Vec<InfraError>,
) -> Result<Vec<Operation>> {
    let mut fixes: HashMap<ObjectRef, Fix> = HashMap::new();
    for (object_ref, errors) in &infra_errors.into_iter().group_by(OSRDObject::get_ref) {
        let fixes_for_object_errors = match object_ref.obj_type {
            ObjectType::TrackSection => {
                let track_section = infra_cache
                    .get_track_section(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                track_section::fix_track_section(track_section, errors)
            }
            ObjectType::Signal => {
                let signal = infra_cache
                    .get_signal(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                signal::fix_signal(signal, errors)
            }
            ObjectType::SpeedSection => {
                let speed_section = infra_cache
                    .get_speed_section(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                speed_section::fix_speed_section(speed_section, errors)
            }
            ObjectType::Detector => {
                let detector = infra_cache
                    .get_detector(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                detector::fix_detector(detector, errors)
            }
            ObjectType::Switch => {
                let switch = infra_cache
                    .get_switch(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                switch::fix_switch(switch, errors)
            }
            ObjectType::BufferStop => {
                let buffer_stop = infra_cache
                    .get_buffer_stop(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                buffer_stop::fix_buffer_stop(buffer_stop, errors)
            }
            ObjectType::Route => {
                let route = infra_cache
                    .get_route(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                route::fix_route(route, errors)
            }
            ObjectType::OperationalPoint => {
                let operational_point = infra_cache
                    .get_operational_point(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                operational_point::fix_operational_point(operational_point, errors)
            }
            ObjectType::Electrification => {
                let electrification = infra_cache
                    .get_electrification(&object_ref.obj_id)
                    .map_err(|e| AutoFixesEditoastError::MissingErrorObject { source: e })?;
                electrifications::fix_electrification(electrification, errors)
            }
            object_type => {
                debug!("error not (yet) fixable on '{}'", object_type);
                HashMap::default()
            }
        };

        fixes = fixes_for_object_errors.into_iter().try_fold(
            fixes,
            |mut fixes, (object_ref, fix)| {
                // cannot use `fixes.insert()` because we want to detect before inserting
                // `Entry` doesn't have an API to return an error if key already exists
                match fixes.entry(object_ref) {
                    Entry::Occupied(entry) => {
                        return Err(AutoFixesEditoastError::ConflictingFixesOnSameObject {
                            object: entry.key().clone(),
                            fixes: vec![entry.get().0.clone(), fix.0],
                        })
                    }
                    Entry::Vacant(entry) => entry.insert(fix),
                };
                Ok(fixes)
            },
        )?;
    }
    let (operations, cache_operations): (Vec<Operation>, Vec<CacheOperation>) =
        fixes.into_values().unzip();
    infra_cache
        .apply_operations(&cache_operations)
        .map_err(|source| AutoFixesEditoastError::FixTrialFailure { source })?;
    Ok(operations)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "auto_fixes")]
pub enum AutoFixesEditoastError {
    #[error(
        "Reached maximum number of iterations to fix infra without providing every possible fixe"
    )]
    #[editoast_error(status = 500)]
    MaximumIterationReached,
    #[error("Failed trying to apply fixes")]
    #[editoast_error(status = 500)]
    FixTrialFailure { source: InternalError },
    #[error("Conflicting fixes for the same object on the same fix-iteration")]
    #[editoast_error(status = 500)]
    ConflictingFixesOnSameObject {
        object: ObjectRef,
        fixes: Vec<Operation>,
    },
    #[error("Failed to find the error's object")]
    #[editoast_error(status = 500)]
    MissingErrorObject { source: InternalError },
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::tests::{db_pool, empty_infra, small_infra};
    use crate::infra_cache::InfraCacheEditoastError;
    use crate::schema::operation::{DeleteOperation, Operation, RailjsonObject};
    use crate::schema::utils::Identifier;
    use crate::schema::{
        ApplicableDirectionsTrackRange, BufferStop, BufferStopCache, BufferStopExtension, Detector,
        DetectorCache, Electrification, Endpoint, OSRDIdentified as _, ObjectRef, ObjectType,
        OperationalPoint, OperationalPointPart, Route, Signal, SignalCache, Slope, SpeedSection,
        Switch, TrackEndpoint, TrackSection, Waypoint,
    };
    use crate::views::pagination::PaginatedResponse;
    use crate::views::tests::create_test_service;
    use actix_http::{Request, StatusCode};
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use serde_json::json;
    use std::collections::HashMap;

    async fn get_infra_cache(infra: &Infra) -> InfraCache {
        InfraCache::load(&mut db_pool().get().await.unwrap(), infra)
            .await
            .unwrap()
    }

    async fn force_refresh(infra: &Infra) {
        infra
            .refresh(db_pool(), true, &get_infra_cache(infra).await)
            .await
            .unwrap();
    }

    fn errors_request(infra_id: i64) -> Request {
        TestRequest::get()
            .uri(format!("/infra/{infra_id}/errors").as_str())
            .to_request()
    }

    fn auto_fixes_request(infra_id: i64) -> Request {
        TestRequest::get()
            .uri(format!("/infra/{infra_id}/auto_fixes").as_str())
            .to_request()
    }

    #[rstest::rstest]
    async fn test_no_fix() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let response = call_service(&app, auto_fixes_request(small_infra_id)).await;

        assert_eq!(response.status(), StatusCode::OK);
        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.is_empty());
    }

    #[rstest::rstest]
    async fn test_fix_invalid_ref_puntual_objects() {
        // GIVEN
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();
        force_refresh(&small_infra.model).await;

        // Check the only initial issues are "overlapping_speed_sections" warnings
        let infra_errors_before_all: PaginatedResponse<crate::views::infra::errors::InfraError> =
            read_body_json(call_service(&app, errors_request(small_infra_id)).await).await;
        assert!(infra_errors_before_all.results.iter().all(|e| e
            .information
            .get("error_type")
            .unwrap()
            == "overlapping_speed_sections"));

        // Remove a track
        let deletion = Operation::Delete(DeleteOperation {
            obj_id: "TA1".to_string(),
            obj_type: ObjectType::TrackSection,
        });
        let req_del = TestRequest::post()
            .uri(format!("/infra/{small_infra_id}/").as_str())
            .set_json(json!([deletion]))
            .to_request();
        assert_eq!(call_service(&app, req_del).await.status(), StatusCode::OK);

        let infra_errors_before_fix: PaginatedResponse<crate::views::infra::errors::InfraError> =
            read_body_json(call_service(&app, errors_request(small_infra_id)).await).await;
        // Check that some new issues appeared
        assert!(infra_errors_before_fix.count > infra_errors_before_all.count);

        // WHEN
        let response = call_service(&app, auto_fixes_request(small_infra_id)).await;

        // THEN
        let infra_errors_after_fix: PaginatedResponse<crate::views::infra::errors::InfraError> =
            read_body_json(call_service(&app, errors_request(small_infra_id)).await).await;
        assert_eq!(infra_errors_after_fix, infra_errors_before_fix);

        assert_eq!(response.status(), StatusCode::OK);
        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "SA0".to_string(),
            obj_type: ObjectType::Signal,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "buffer_stop.1".to_string(),
            obj_type: ObjectType::BufferStop,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "DA0".to_string(),
            obj_type: ObjectType::Detector,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "PA0".to_string(),
            obj_type: ObjectType::Switch,
        })));
    }

    #[rstest::rstest]
    async fn test_fix_invalid_ref_route_entry_exit() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();
        // Remove a buffer stop
        let deletion = Operation::Delete(DeleteOperation {
            obj_id: "buffer_stop.4".to_string(),
            obj_type: ObjectType::BufferStop,
        });
        let req_del = TestRequest::post()
            .uri(format!("/infra/{small_infra_id}/").as_str())
            .set_json(json!([deletion]))
            .to_request();
        assert_eq!(call_service(&app, req_del).await.status(), StatusCode::OK);

        let response = call_service(&app, auto_fixes_request(small_infra_id)).await;

        assert_eq!(response.status(), StatusCode::OK);
        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "rt.DE0->buffer_stop.4".to_string(),
            obj_type: ObjectType::Route,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "rt.buffer_stop.4->DD5".to_string(),
            obj_type: ObjectType::Route,
        })));
    }

    #[test]
    fn test_invalid_ref_signal_fix() {
        let signal = SignalCache::new("SA0".to_string(), "TA1".to_string(), 0.0, vec![]);
        let error = InfraError::new_invalid_reference(
            &signal,
            "track",
            ObjectRef::new(ObjectType::TrackSection, "TA1"),
        );

        let mut infra_cache = InfraCache::default();
        infra_cache.add(signal.clone()).unwrap();
        let operations = fix_infra(&mut infra_cache, vec![error]).unwrap();
        let operation = operations.first().unwrap();
        assert_eq!(
            operation,
            &Operation::Delete(DeleteOperation {
                obj_id: signal.get_id().to_string(),
                obj_type: ObjectType::Signal,
            })
        );
        assert!(!infra_cache.signals().contains_key(signal.get_id()));
    }

    #[rstest::rstest]
    async fn test_wrong_invalid_ref_signal_fix() {
        let signal = SignalCache::new("SA0".to_string(), "TA1".to_string(), 0.0, vec![]);
        let error = InfraError::new_invalid_reference(
            &signal,
            "track",
            ObjectRef::new(ObjectType::Detector, "TA1"),
        );

        let mut infra_cache = InfraCache::default();
        let error = fix_infra(&mut infra_cache, vec![error]).unwrap_err();
        assert_eq!(
            error,
            AutoFixesEditoastError::MissingErrorObject {
                source: InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Signal.to_string(),
                    obj_id: signal.get_id().to_string()
                }
                .into()
            }
            .into()
        );
    }

    #[test]
    fn test_invalid_ref_route_fix_entry() {
        let missing_bs_id = "missing_bs_id";
        let exit_bs_id = "exit_bs_id";
        let route = Route {
            id: Identifier::from("route_id"),
            entry_point: Waypoint::new_buffer_stop(missing_bs_id),
            exit_point: Waypoint::new_buffer_stop(exit_bs_id),
            ..Default::default()
        };
        let error = InfraError::new_invalid_reference(
            &route,
            "entry_point",
            ObjectRef::new(ObjectType::BufferStop, missing_bs_id),
        );
        let mut infra_cache = InfraCache::default();
        infra_cache
            .add(BufferStopCache::new(
                exit_bs_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();
        infra_cache.add(route.clone()).unwrap();

        // Delete the route: the entry point doesn't exist.
        let operations = fix_infra(&mut infra_cache, vec![error]).unwrap();
        let operation = operations.first().unwrap();
        assert_eq!(
            operation,
            &Operation::Delete(DeleteOperation {
                obj_id: route.get_id().to_string(),
                obj_type: ObjectType::Route,
            })
        );
        assert!(!infra_cache.routes().contains_key(route.get_id()));
    }

    #[test]
    fn test_invalid_ref_route_missing() {
        let missing_bs_id = "missing_bs_id";
        let exit_bs_id = "exit_bs_id";
        let route = Route {
            id: Identifier::from("route_id"),
            entry_point: Waypoint::new_buffer_stop(missing_bs_id),
            exit_point: Waypoint::new_buffer_stop(exit_bs_id),
            ..Default::default()
        };
        let error = InfraError::new_invalid_reference(
            &route,
            "entry_point",
            ObjectRef::new(ObjectType::BufferStop, missing_bs_id),
        );
        let mut infra_cache = InfraCache::default();
        infra_cache
            .add(BufferStopCache::new(
                exit_bs_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();

        // Error: the route is not in the cache.
        let error = fix_infra(&mut infra_cache, vec![error]).unwrap_err();
        assert_eq!(
            error,
            AutoFixesEditoastError::MissingErrorObject {
                source: InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Route.to_string(),
                    obj_id: route.get_id().to_string()
                }
                .into()
            }
            .into()
        );
    }

    #[test]
    fn test_invalid_ref_route_fix_exit() {
        let missing_detector_id = "missing_detector_id";
        let entry_detector_id = "entry_detector_id";
        let route = Route {
            id: Identifier::from("route_id"),
            entry_point: Waypoint::new_detector(entry_detector_id),
            exit_point: Waypoint::new_detector(missing_detector_id),
            ..Default::default()
        };
        let error = InfraError::new_invalid_reference(
            &route,
            "exit_point",
            ObjectRef::new(ObjectType::Detector, missing_detector_id),
        );
        let mut infra_cache = InfraCache::default();
        infra_cache
            .add(DetectorCache::new(
                entry_detector_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();
        infra_cache.add(route.clone()).unwrap();

        // Delete the route: the exit point doesn't exist.
        let operations = fix_infra(&mut infra_cache, vec![error]).unwrap();
        let operation = operations.first().unwrap();
        assert_eq!(
            operation,
            &Operation::Delete(DeleteOperation {
                obj_id: route.get_id().to_string(),
                obj_type: ObjectType::Route,
            })
        );
        assert!(!infra_cache.routes().contains_key(route.get_id()));
    }

    #[test]
    fn test_invalid_ref_route_nofix() {
        let entry_detector_id = "entry_detector_id";
        let exit_detector_id = "exit_detector_id";
        let missing_detector_id = "missing_detector_id";
        let track_id = "track_id";
        let route = Route {
            id: Identifier::from("route_id"),
            entry_point: Waypoint::new_detector(entry_detector_id),
            exit_point: Waypoint::new_detector(exit_detector_id),
            release_detectors: vec![Identifier::from(missing_detector_id)],
            ..Default::default()
        };
        let error = InfraError::new_invalid_reference(
            &route,
            "release_detectors",
            ObjectRef::new(ObjectType::Detector, missing_detector_id),
        );
        let mut infra_cache = InfraCache::default();
        infra_cache
            .add(DetectorCache::new(
                entry_detector_id.to_string(),
                track_id.to_string(),
                0.0,
            ))
            .unwrap();
        infra_cache
            .add(DetectorCache::new(
                exit_detector_id.to_string(),
                track_id.to_string(),
                1000.0,
            ))
            .unwrap();
        infra_cache.add(route).unwrap();

        // Don't delete the route: entry and exit points are fine.
        let operations = fix_infra(&mut infra_cache, vec![error]).unwrap();
        assert!(operations.is_empty());
    }

    fn get_create_operation_request(railjson: RailjsonObject, infra_id: i64) -> Request {
        let create_operation = Operation::Create(Box::new(railjson));
        TestRequest::post()
            .uri(format!("/infra/{infra_id}/").as_str())
            .set_json(json!([create_operation]))
            .to_request()
    }

    #[rstest::rstest]
    async fn invalid_switch_ports() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let ports = HashMap::from([
            ("WRONG".into(), TrackEndpoint::new("TA1", Endpoint::End)),
            ("B1".into(), TrackEndpoint::new("TA3", Endpoint::Begin)),
            ("B2".into(), TrackEndpoint::new("TA4", Endpoint::Begin)),
        ]);
        let invalid_switch = Switch {
            switch_type: "point_switch".into(),
            ports,
            ..Default::default()
        };
        // Create an invalid switch
        let req_create =
            get_create_operation_request(invalid_switch.clone().into(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let response = call_service(&app, auto_fixes_request(small_infra_id)).await;
        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: invalid_switch.get_id().to_string(),
            obj_type: ObjectType::Switch,
        })));
    }

    #[rstest::rstest]
    async fn odd_buffer_stop_location() {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        // Create an odd buffer stops (to a track endpoint linked by a switch)
        let track: RailjsonObject = TrackSection {
            id: "test_track".into(),
            length: 1_000.0,
            ..Default::default()
        }
        .into();
        let bs_start = BufferStop {
            id: "bs_start".into(),
            track: track.get_id().as_str().into(),
            position: 0.0,
            ..Default::default()
        }
        .into();
        let bs_stop = BufferStop {
            id: "bs_stop".into(),
            track: track.get_id().as_str().into(),
            position: 1_000.0,
            ..Default::default()
        }
        .into();
        let bs_odd = BufferStop {
            id: "bs_odd".into(),
            track: track.get_id().as_str().into(),
            position: 800.0,
            ..Default::default()
        }
        .into();
        for obj in [&track, &bs_start, &bs_stop, &bs_odd] {
            let req_create = get_create_operation_request(obj.clone(), empty_infra_id);
            assert_eq!(
                call_service(&app, req_create).await.status(),
                StatusCode::OK
            );
        }

        let response = call_service(&app, auto_fixes_request(empty_infra_id)).await;

        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: bs_odd.get_id().clone(),
            obj_type: ObjectType::BufferStop,
        })));
    }

    #[rstest::rstest]
    async fn empty_object() {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let electrification: RailjsonObject = Electrification::default().into();
        let operational_point = OperationalPoint::default().into();
        let speed_section = SpeedSection::default().into();

        for obj in [&electrification, &operational_point, &speed_section] {
            let req_create = get_create_operation_request(obj.clone(), empty_infra_id);
            assert_eq!(
                call_service(&app, req_create).await.status(),
                StatusCode::OK
            );
        }

        let response = call_service(&app, auto_fixes_request(empty_infra_id)).await;
        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;

        for obj in [&electrification, &operational_point, &speed_section] {
            assert!(operations.contains(&Operation::Delete(DeleteOperation {
                obj_id: obj.get_id().to_string(),
                obj_type: obj.get_type(),
            })))
        }
    }

    #[rstest::rstest]
    async fn out_of_range_must_be_ignored() {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let track: RailjsonObject = TrackSection {
            id: "test_track".into(),
            length: 1_000.0,
            slopes: vec![Slope {
                begin: 250.0,
                end: 1250.0,
                gradient: 0.,
            }],
            ..Default::default()
        }
        .into();

        let electrification: RailjsonObject = Electrification {
            track_ranges: vec![ApplicableDirectionsTrackRange {
                track: track.get_id().as_str().into(),
                begin: 250.0,
                end: 1250.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();

        let operational_point: RailjsonObject = OperationalPoint {
            parts: vec![OperationalPointPart {
                track: track.get_id().as_str().into(),
                position: 1250.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();

        let speed_section: RailjsonObject = SpeedSection {
            track_ranges: vec![ApplicableDirectionsTrackRange {
                track: track.get_id().as_str().into(),
                begin: 250.0,
                end: 1250.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();

        for obj in [&track, &electrification, &operational_point, &speed_section] {
            let req_create = get_create_operation_request(obj.clone(), empty_infra_id);
            assert_eq!(
                call_service(&app, req_create).await.status(),
                StatusCode::OK
            );
        }

        let response = call_service(&app, auto_fixes_request(empty_infra_id)).await;
        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;

        for obj in [&track, &electrification, &operational_point, &speed_section] {
            assert!(!operations.contains(&Operation::Delete(DeleteOperation {
                obj_id: obj.get_id().to_string(),
                obj_type: obj.get_type(),
            })))
        }
    }

    #[rstest::rstest]
    #[case(250., 1)]
    #[case(1250., 5)]
    async fn out_of_range_must_be_deleted(#[case] pos: f64, #[case] error_count: usize) {
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let track: RailjsonObject = TrackSection {
            id: "test_track".into(),
            length: 1_000.0,
            geo: geos::geojson::Geometry::new(geos::geojson::Value::LineString(vec![
                vec![0.0, 0.0],
                vec![1.0, 1.0],
            ])),
            sch: geos::geojson::Geometry::new(geos::geojson::Value::LineString(vec![
                vec![0.0, 0.0],
                vec![1.0, 1.0],
            ])),
            ..Default::default()
        }
        .into();

        let signal: RailjsonObject = Signal {
            position: pos,
            track: track.get_id().as_str().into(),
            ..Default::default()
        }
        .into();

        let detector: RailjsonObject = Detector {
            position: pos,
            track: track.get_id().as_str().into(),
            ..Default::default()
        }
        .into();

        let buffer_stop: RailjsonObject = BufferStop {
            position: pos,
            track: track.get_id().as_str().into(),
            ..Default::default()
        }
        .into();

        for obj in [&track, &signal, &detector, &buffer_stop] {
            let req_create = get_create_operation_request(obj.clone(), empty_infra_id);
            assert_eq!(
                call_service(&app, req_create).await.status(),
                StatusCode::OK
            );
        }

        let response = call_service(&app, auto_fixes_request(empty_infra_id)).await;
        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert_eq!(operations.len(), error_count);

        if !operations.len() == 5 {
            for obj in [&signal, &detector, &buffer_stop] {
                assert!(operations.contains(&Operation::Delete(DeleteOperation {
                    obj_id: obj.get_id().to_string(),
                    obj_type: obj.get_type(),
                })))
            }
        }
    }

    #[rstest::rstest]
    async fn missing_track_extremity_buffer_stop_fix() {
        // GIVEN
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let track: RailjsonObject = TrackSection {
            id: "track_with_no_buffer_stops".into(),
            length: 1_000.0,
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(track.clone(), empty_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        // WHEN
        let response = call_service(&app, auto_fixes_request(empty_infra_id)).await;

        // THEN
        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert_eq!(operations.len(), 2);
        let mut positions = vec![];
        for operation in operations {
            let Operation::Create(boxed_buffer_stop) = operation else {
                panic!("Unexpected Operation type.")
            };
            let RailjsonObject::BufferStop {
                railjson: buffer_stop,
            } = *boxed_buffer_stop
            else {
                panic!("Unexpected RailjsonObject type.")
            };
            assert_eq!(buffer_stop.track, Identifier::from(track.get_id().as_str()));
            assert_eq!(buffer_stop.extensions, BufferStopExtension::default());
            positions.push(buffer_stop.position);
        }
        positions.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert_eq!(positions, vec![0., 1_000.0]);
    }
}
