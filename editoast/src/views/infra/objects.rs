use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::DerefMut;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::primitives::ObjectType;
use thiserror::Error;

use super::InfraApiError;
use super::InfraIdParam;
use crate::error::Result;
use crate::modelsv2::infra::ObjectQueryable;
use crate::modelsv2::Infra;
use crate::Retrieve;

crate::routes! {
    "/objects/{object_type}" => get_objects,
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
    post, path = "",
    tag = "infra",
    params(InfraIdParam, ObjectTypeParam),
    request_body = Vec<String>,
    responses(
        (status = 200, description = "The list of objects", body = Vec<InfraObjectWithGeometry>),
        (status = 400, description = "Duplicate object ids provided"),
        (status = 404, description = "Object ID or infra ID invalid")
    )
)]
async fn get_objects(
    Path(infra_id_param): Path<InfraIdParam>,
    Path(object_type_param): Path<ObjectTypeParam>,
    State(db_pool): State<DbConnectionPoolV2>,
    Json(obj_ids): Json<Vec<String>>,
) -> Result<Json<Vec<ObjectQueryable>>> {
    let infra_id = infra_id_param.infra_id;
    if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let objects = infra
        .get_objects(
            db_pool.get().await?.deref_mut(),
            object_type_param.object_type,
            &obj_ids,
        )
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
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use serde_json::Value as JsonValue;
    use std::ops::DerefMut;

    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::views::infra::objects::ObjectQueryable;
    use crate::views::test_app::TestAppBuilder;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::primitives::OSRDIdentified;

    #[rstest]
    async fn check_invalid_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let request = app
            .post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .json(&["invalid_id"]);

        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_objects_no_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let request = app
            .post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .json(&vec![""; 0]);

        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn get_objects_should_return_switch() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let switch = Switch {
            id: "switch_001".into(),
            switch_type: "switch_type_001".into(),
            ..Default::default()
        };
        apply_create_operation(
            &switch.clone().into(),
            empty_infra.id,
            db_pool.get_ok().deref_mut(),
        )
        .await
        .expect("Failed to create switch object");

        // WHEN
        let request = app
            .post(format!("/infra/{}/objects/Switch", empty_infra.id).as_str())
            .json(&vec!["switch_001"]);

        // THEN
        let switch_object: Vec<ObjectQueryable> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
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
    async fn get_objects_duplicate_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let request = app
            .post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .json(&vec!["id"; 2]);

        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_switch_types() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        // Add a switch type
        let switch_type = SwitchType::default();
        apply_create_operation(
            &switch_type.clone().into(),
            empty_infra.id,
            db_pool.get_ok().deref_mut(),
        )
        .await
        .expect("Failed to create switch type object");

        let request = app
            .post(format!("/infra/{}/objects/SwitchType", empty_infra.id).as_str())
            .json(&vec![switch_type.id.clone()]);

        let switch_type_object: Vec<ObjectQueryable> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let expected_switch_type_object = vec![ObjectQueryable {
            obj_id: switch_type.get_id().to_string(),
            railjson: json!({
                "id": switch_type.get_id().to_string(),
                "ports": [],
                "groups": {}
            }),
            geographic: None,
        }];
        assert_eq!(switch_type_object, expected_switch_type_object);
    }
}
