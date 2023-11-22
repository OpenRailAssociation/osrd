use std::collections::HashSet;

use crate::error::Result;
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
        let new_fixes = fix_infra(&mut infra_cache_clone)?;
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

fn fix_infra(infra_cache: &mut InfraCache) -> Result<Vec<Operation>> {
    let infra_errors = generate_infra_errors(infra_cache);

    let mut delete_fixes_already_retained = HashSet::new();
    let mut all_fixes = vec![];

    for error in infra_errors {
        for operation in get_operations_fixing_error(&error)? {
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
    infra_cache.apply_operations(&operation_results);

    Ok(all_fixes)
}

fn get_operations_fixing_error(error: &InfraError) -> Result<Vec<Operation>> {
    match error.get_sub_type() {
        InfraErrorType::InvalidReference { reference } => {
            get_operations_fixing_invalid_reference(error, reference)
        }
        _ => Ok(vec![]), // Default: nothing is done to fix error
    }
}

fn get_operations_fixing_invalid_reference(
    error: &InfraError,
    reference: &ObjectRef,
) -> Result<Vec<Operation>> {
    // BufferStop or Signal invalid-reference on track
    if [
        ObjectType::BufferStop,
        ObjectType::Signal,
        ObjectType::Detector,
    ]
    .contains(&error.get_type())
        && reference.obj_type == ObjectType::TrackSection
    {
        return Ok([Operation::Delete(DeleteOperation {
            obj_id: error.get_id().to_string(),
            obj_type: error.get_type(),
        })]
        .to_vec());
    }

    Ok(vec![])
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "auto_fixes")]
pub enum AutoFixesEditoastError {
    #[error(
        "Reached maximum number of iterations to fix infra without providing every possible fixe"
    )]
    #[editoast_error(status = 500)]
    MaximumIterationReached(),
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, small_infra};
    use crate::schema::operation::{DeleteOperation, Operation};
    use crate::schema::{ObjectRef, ObjectType, SignalCache};
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
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

    #[test]
    fn test_invalid_ref_signal_fix() {
        let error = InfraError::new_invalid_reference(
            &SignalCache::new("SA0".to_string(), "TA1".to_string(), 0.0, vec![]),
            "track",
            ObjectRef::new(ObjectType::TrackSection, "TA1"),
        );

        assert_eq!(
            get_operations_fixing_error(&error).unwrap(),
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

        assert!(get_operations_fixing_error(&error).unwrap().is_empty());
    }
}
