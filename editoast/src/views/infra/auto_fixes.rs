use std::collections::HashSet;

use crate::error::{InternalError, Result};
use crate::generated_data::generate_infra_errors;
use crate::infra_cache::InfraCache;
use crate::models::{self, Infra, Retrieve};
use crate::schema::operation::{DeleteOperation, Operation};
use crate::schema::{
    InfraError, InfraErrorType, OSRDIdentified, OSRDObject, ObjectRef, ObjectType,
};
use crate::views::infra::InfraIdParam;
use crate::DbPool;
use actix_web::get;
use actix_web::web::{Data, Json as WebJson, Path};
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use itertools::Itertools;
use thiserror::Error;

const MAX_AUTO_FIXES_ITERATIONS: u8 = 5;

// Return `/infra/<infra_id>/auto_fixes` routes
crate::routes! {"/infra/{infra_id}/auto_fixes" => { list_auto_fixes, } } // TODO:  move it to infra when migrated (and un-pub module)

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
        let new_fixes = fix_infra(&mut infra_cache_clone).await?;
        if new_fixes.is_empty() {
            // Every possible error is fixed
            return Ok(WebJson(fixes));
        }
        fixes.extend(new_fixes);
    }

    // Reapplying an auto-fix should do nothing.
    // And few iterations are supposed to provide every possible fix.
    // Yet after reaching the maximum number of iterations, there are still fixes available.
    Err(AutoFixesEditoastError::MaximumIterationReached().into())
}

async fn fix_infra(infra_cache: &mut InfraCache) -> Result<Vec<Operation>> {
    let infra_errors = generate_infra_errors(infra_cache).await;

    let mut delete_fixes_already_retained = HashSet::new();
    let mut all_fixes = vec![];

    for error in infra_errors {
        for operation in get_operations_fixing_error(&error, infra_cache)? {
            let mut must_retain = true;
            if let Operation::Delete(ref delete_operation) = operation {
                must_retain = delete_fixes_already_retained.insert(delete_operation.to_owned());
            }
            if must_retain {
                all_fixes.push(operation);
            }
        }
    }

    let operation_results = all_fixes.iter().map_into().collect();
    infra_cache
        .apply_operations(&operation_results)
        .map_err(|source| AutoFixesEditoastError::FixTrialFailure { source })?;

    Ok(all_fixes)
}

fn get_operations_fixing_error(
    error: &InfraError,
    infra_cache: &InfraCache,
) -> Result<Vec<Operation>> {
    match error.get_sub_type() {
        InfraErrorType::InvalidReference { reference } => {
            get_operations_fixing_invalid_reference(error, reference, infra_cache)
        }
        InfraErrorType::OutOfRange { .. } => get_operations_fixing_out_of_range(error),
        InfraErrorType::InvalidSwitchPorts | InfraErrorType::EmptyObject => {
            Ok([Operation::Delete(DeleteOperation {
                obj_id: error.get_id().to_string(),
                obj_type: error.get_type(),
            })]
            .to_vec())
        }
        _ => Ok(vec![]), // Default: nothing is done to fix error
    }
}

fn get_operations_fixing_invalid_reference(
    error: &InfraError,
    reference: &ObjectRef,
    infra_cache: &InfraCache,
) -> Result<Vec<Operation>> {
    // BufferStop or Signal invalid-reference on track
    match &error.get_type() {
        ObjectType::BufferStop | ObjectType::Signal | ObjectType::Detector => {
            if reference.obj_type == ObjectType::TrackSection {
                Ok([Operation::Delete(DeleteOperation {
                    obj_id: error.get_id().to_string(),
                    obj_type: error.get_type(),
                })]
                .to_vec())
            } else {
                Ok(vec![])
            }
        }
        ObjectType::Route => {
            let route = infra_cache
                .routes()
                .get(error.get_id())
                .ok_or_else(|| AutoFixesEditoastError::MissingErrorObject {
                    error: error.clone(),
                })?
                .unwrap_route();
            if matches!(
                reference.obj_type,
                ObjectType::BufferStop | ObjectType::Detector
            ) && (reference.obj_id.eq(route.entry_point.get_id())
                || reference.obj_id.eq(route.exit_point.get_id()))
            {
                Ok([Operation::Delete(DeleteOperation {
                    obj_id: error.get_id().to_string(),
                    obj_type: ObjectType::Route,
                })]
                .to_vec())
            } else {
                Ok(vec![])
            }
        }
        _ => Ok(vec![]),
    }
}

fn get_operations_fixing_out_of_range(error: &InfraError) -> Result<Vec<Operation>> {
    match &error.get_type() {
        ObjectType::BufferStop | ObjectType::Signal | ObjectType::Detector => {
            Ok([Operation::Delete(DeleteOperation {
                obj_id: error.get_id().to_string(),
                obj_type: error.get_type(),
            })]
            .to_vec())
        }
        _ => Ok(vec![]),
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "auto_fixes")]
pub enum AutoFixesEditoastError {
    #[error(
        "Reached maximum number of iterations to fix infra without providing every possible fixe"
    )]
    #[editoast_error(status = 500)]
    MaximumIterationReached(),
    #[error("Failed trying to apply fixes")]
    #[editoast_error(status = 500)]
    FixTrialFailure { source: InternalError },
    #[error("Failed to find the error's object")]
    #[editoast_error(status = 500)]
    MissingErrorObject { error: InfraError },
}

#[cfg(test)]
mod test {
    use std::collections::HashMap;

    use super::*;
    use crate::fixtures::tests::{db_pool, small_infra};
    use crate::schema::operation::{DeleteOperation, Operation, RailjsonObject};
    use crate::schema::utils::Identifier;
    use crate::schema::{
        ApplicableDirectionsTrackRange, BufferStop, BufferStopCache, Catenary, Detector,
        DetectorCache, Endpoint, ObjectRef, ObjectType, OperationalPoint, OperationalPointPart,
        Route, Signal, SignalCache, Slope, SpeedSection, Switch, TrackEndpoint, TrackSection,
        Waypoint,
    };
    use crate::views::tests::create_test_service;
    use actix_http::{Request, StatusCode};
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use serde_json::json;

    #[rstest::rstest]
    async fn test_no_fix() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);
        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.is_empty());
    }

    #[rstest::rstest]
    async fn test_fix_invalid_ref_signal_buffer_stop() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();
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

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

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

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);
        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "rt.DE0->buffer_stop.4".to_string(),
            obj_type: ObjectType::Route,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: "rt.buffer_stop.4->DF0".to_string(),
            obj_type: ObjectType::Route,
        })));
    }

    #[test]
    fn test_invalid_ref_signal_fix() {
        let error = InfraError::new_invalid_reference(
            &SignalCache::new("SA0".to_string(), "TA1".to_string(), 0.0, vec![]),
            "track",
            ObjectRef::new(ObjectType::TrackSection, "TA1"),
        );

        assert_eq!(
            get_operations_fixing_error(&error, &InfraCache::default()).unwrap(),
            vec![Operation::Delete(DeleteOperation {
                obj_id: "SA0".to_string(),
                obj_type: ObjectType::Signal,
            })]
        );
    }

    #[test]
    fn test_wrong_invalid_ref_signal_fix() {
        let error = InfraError::new_invalid_reference(
            &SignalCache::new("SA0".to_string(), "TA1".to_string(), 0.0, vec![]),
            "track",
            ObjectRef::new(ObjectType::Detector, "TA1"),
        );

        assert!(get_operations_fixing_error(&error, &InfraCache::default())
            .unwrap()
            .is_empty());
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
        let mut cache = InfraCache::default();
        cache
            .add(BufferStopCache::new(
                exit_bs_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();
        cache.add(route).unwrap();

        // Delete the route: the entry point doesn't exist.
        assert_eq!(
            get_operations_fixing_error(&error, &cache).unwrap(),
            vec![Operation::Delete(DeleteOperation {
                obj_id: "route_id".to_string(),
                obj_type: ObjectType::Route,
            })]
        );
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
        let mut cache = InfraCache::default();
        cache
            .add(BufferStopCache::new(
                exit_bs_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();

        // Error: the route is not in the cache.
        assert_eq!(
            get_operations_fixing_error(&error, &cache).unwrap_err(),
            AutoFixesEditoastError::MissingErrorObject { error }.into()
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
        let mut cache = InfraCache::default();
        cache
            .add(DetectorCache::new(
                entry_detector_id.to_string(),
                "track_id".to_string(),
                0.0,
            ))
            .unwrap();
        cache.add(route).unwrap();

        // Delete the route: the exit point doesn't exist.
        assert_eq!(
            get_operations_fixing_error(&error, &cache).unwrap(),
            vec![Operation::Delete(DeleteOperation {
                obj_id: "route_id".to_string(),
                obj_type: ObjectType::Route,
            })]
        );
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
        let mut cache = InfraCache::default();
        cache
            .add(DetectorCache::new(
                entry_detector_id.to_string(),
                track_id.to_string(),
                0.0,
            ))
            .unwrap();
        cache
            .add(DetectorCache::new(
                exit_detector_id.to_string(),
                track_id.to_string(),
                1000.0,
            ))
            .unwrap();
        cache.add(route).unwrap();

        // Don't delete the route: entry and exit points are fine.
        assert!(get_operations_fixing_error(&error, &cache)
            .unwrap()
            .is_empty());
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
            (
                "WRONG".into(),
                TrackEndpoint {
                    endpoint: Endpoint::End,
                    track: "TA1".into(),
                },
            ),
            (
                "B1".into(),
                TrackEndpoint {
                    endpoint: Endpoint::Begin,
                    track: "TA3".into(),
                },
            ),
            (
                "B2".into(),
                TrackEndpoint {
                    endpoint: Endpoint::Begin,
                    track: "TA4".into(),
                },
            ),
        ]);
        let invalid_switch = Switch {
            switch_type: "point_switch".into(),
            ports,
            ..Default::default()
        };
        let invalid_switch_railjson = RailjsonObject::Switch {
            railjson: invalid_switch.clone(),
        };
        // Create an invalid switch
        let req_create = get_create_operation_request(invalid_switch_railjson, small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: invalid_switch.get_id().to_string(),
            obj_type: ObjectType::Switch,
        })));
    }

    #[rstest::rstest]
    async fn empty_object() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let catenary: RailjsonObject = Catenary::default().into();
        let req_create = get_create_operation_request(catenary.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let operational_point: RailjsonObject = OperationalPoint::default().into();
        let req_create = get_create_operation_request(operational_point.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let speed_section: RailjsonObject = SpeedSection::default().into();
        let req_create = get_create_operation_request(speed_section.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: catenary.get_id().to_string(),
            obj_type: ObjectType::Catenary,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: operational_point.get_id().to_string(),
            obj_type: ObjectType::OperationalPoint,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: speed_section.get_id().to_string(),
            obj_type: ObjectType::SpeedSection,
        })));
    }

    #[rstest::rstest]
    async fn out_of_range_must_be_ignored() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let catenary: RailjsonObject = Catenary {
            track_ranges: vec![ApplicableDirectionsTrackRange {
                begin: 100000000000.0,
                end: 100000000001.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(catenary.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let operational_point: RailjsonObject = OperationalPoint {
            parts: vec![OperationalPointPart {
                position: 10000000000000.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(operational_point.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let speed_section: RailjsonObject = SpeedSection {
            track_ranges: vec![ApplicableDirectionsTrackRange {
                begin: 100000000000.0,
                end: 100000000001.0,
                ..Default::default()
            }],
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(speed_section.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let track_section: RailjsonObject = TrackSection {
            slopes: vec![Slope {
                begin: 100000000000.0,
                end: 100000000001.0,
                gradient: 0.1,
            }],
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(track_section.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(!operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: catenary.get_id().to_string(),
            obj_type: ObjectType::Catenary,
        })));
        assert!(!operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: operational_point.get_id().to_string(),
            obj_type: ObjectType::OperationalPoint,
        })));
        assert!(!operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: speed_section.get_id().to_string(),
            obj_type: ObjectType::SpeedSection,
        })));
        assert!(!operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: track_section.get_id().to_string(),
            obj_type: ObjectType::TrackSection,
        })));
    }

    #[rstest::rstest]
    async fn out_of_range_must_be_deleted() {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool()).await;
        let small_infra_id = small_infra.id();

        let signal: RailjsonObject = Signal {
            position: 10000000000000.0,
            track: "TC0".into(),
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(signal.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let detector: RailjsonObject = Detector {
            position: 10000000000000.0,
            track: "TC0".into(),
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(detector.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let buffer_stop: RailjsonObject = BufferStop {
            position: 10000000000000.0,
            track: "TC0".into(),
            ..Default::default()
        }
        .into();
        let req_create = get_create_operation_request(buffer_stop.clone(), small_infra_id);
        assert_eq!(
            call_service(&app, req_create).await.status(),
            StatusCode::OK
        );

        let req_fix = TestRequest::get()
            .uri(format!("/infra/{small_infra_id}/auto_fixes").as_str())
            .to_request();
        let response = call_service(&app, req_fix).await;

        assert_eq!(response.status(), StatusCode::OK);

        let operations: Vec<Operation> = read_body_json(response).await;
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: signal.get_id().to_string(),
            obj_type: ObjectType::Signal,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: detector.get_id().to_string(),
            obj_type: ObjectType::Detector,
        })));
        assert!(operations.contains(&Operation::Delete(DeleteOperation {
            obj_id: buffer_stop.get_id().to_string(),
            obj_type: ObjectType::BufferStop,
        })));
    }
}
