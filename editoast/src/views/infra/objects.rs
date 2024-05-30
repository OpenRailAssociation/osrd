use std::collections::HashMap;
use std::collections::HashSet;

use actix_web::dev::HttpServiceFactory;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use editoast_derive::EditoastError;
use thiserror::Error;

use super::InfraApiError;
use super::InfraIdParam;
use crate::error::Result;
use crate::modelsv2::infra::ObjectQueryable;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::Retrieve;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    get_objects,
}

/// Return `/infra/<infra_id>/objects` routes
pub fn routes_v1() -> impl HttpServiceFactory {
    get_objects
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:objects")]
enum GetObjectsErrors {
    #[error("Duplicate object ids provided")]
    DuplicateIdsProvided,
    #[error("Object id '{object_id}' not found")]
    ObjectIdNotFound { object_id: String },
}

/// Return whether the list of ids contains unique values or has duplicate
fn has_unique_ids(obj_ids: &[String]) -> bool {
    obj_ids.len() == obj_ids.iter().collect::<HashSet<_>>().len()
}

#[derive(serde::Deserialize, utoipa::IntoParams)]
struct ObjectTypeParam {
    object_type: ObjectType,
}

/// Retrieves specific infra objects
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam, ObjectTypeParam),
    request_body = Vec<String>,
    responses(
        (status = 200, description = "The list of objects", body = Vec<InfraObjectWithGeometry>),
        (status = 400, description = "Duplicate object ids provided"),
        (status = 404, description = "Object ID or infra ID invalid")
    )
)]
#[post("/objects/{object_type}")]
async fn get_objects(
    infra_id_param: Path<InfraIdParam>,
    object_type_param: Path<ObjectTypeParam>,
    obj_ids: Json<Vec<String>>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<Vec<ObjectQueryable>>> {
    let infra_id = infra_id_param.infra_id;
    if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let obj_ids = obj_ids.into_inner();
    let objects = infra
        .get_objects(conn, object_type_param.object_type, &obj_ids)
        .await?;

    // Build a cache to reorder the result
    let mut objects: HashMap<_, _> = objects
        .into_iter()
        .map(|obj| (obj.obj_id.clone(), obj))
        .collect();

    // Check all objects exist
    if objects.len() != obj_ids.len() {
        let not_found_id = obj_ids
            .iter()
            .find(|obj_id| !objects.contains_key(*obj_id))
            .unwrap();
        return Err(GetObjectsErrors::ObjectIdNotFound {
            object_id: not_found_id.clone(),
        }
        .into());
    }

    // Reorder the result to match the order of the input
    let mut result = vec![];
    obj_ids.iter().for_each(|obj_id| {
        result.push(objects.remove(obj_id).unwrap());
    });

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use actix_web::http::StatusCode;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use rstest::*;
    use serde_json::json;
    use serde_json::Value as JsonValue;

    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::infra_cache::operation::Operation;
    use crate::modelsv2::Infra;
    use crate::views::infra::objects::ObjectQueryable;
    use crate::views::infra::tests::create_object_request;
    use crate::views::tests::create_test_service;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::primitives::OSRDIdentified;

    #[rstest]
    async fn check_invalid_ids(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", empty_infra.id()).as_str())
            .set_json(["invalid_id"])
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_objects_no_ids(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", empty_infra.id()).as_str())
            .set_json(vec![""; 0])
            .to_request();
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);
    }

    #[rstest]
    async fn get_objects_should_return_switch() {
        // GIVEN
        let app = create_test_service().await;
        let empty_infra = empty_infra(db_pool()).await;
        let empty_infra_id = empty_infra.id();

        let switch = Switch {
            id: "switch_001".into(),
            switch_type: "switch_type_001".into(),
            ..Default::default()
        };

        let create_operation = Operation::Create(Box::new(switch.clone().into()));
        let request = TestRequest::post()
            .uri(format!("/infra/{empty_infra_id}/").as_str())
            .set_json(json!([create_operation]))
            .to_request();
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::OK);

        // WHEN
        let req = TestRequest::post()
            .uri(format!("/infra/{empty_infra_id}/objects/Switch").as_str())
            .set_json(vec!["switch_001"])
            .to_request();
        let response = call_service(&app, req).await;

        // THEN
        assert_eq!(response.status(), StatusCode::OK);
        let switch_object: Vec<ObjectQueryable> = read_body_json(response).await;
        let expected_switch_object = vec![ObjectQueryable {
            obj_id: switch.get_id().to_string(),
            railjson: json!({
                "extensions": {
                    "sncf": JsonValue::Null
                },
                "group_change_delay": 0.0,
                "id": switch.get_id().to_string(),
                "ports": {},
                "switch_type": switch.switch_type
            }),
            geographic: None,
        }];
        assert_eq!(switch_object, expected_switch_object);
    }

    #[rstest]
    async fn get_objects_duplicate_ids(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", empty_infra.id()).as_str())
            .set_json(vec!["id"; 2])
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_switch_types(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        // Add a switch type
        let switch_type = SwitchType::default();
        let switch_id = switch_type.id.clone();
        let req = create_object_request(empty_infra.id(), switch_type.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/SwitchType", empty_infra.id()).as_str())
            .set_json(vec![switch_id])
            .to_request();
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);
    }
}
