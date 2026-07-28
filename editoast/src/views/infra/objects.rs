use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use schemas::primitives::ObjectType;
use thiserror::Error;

use super::InfraApiError;
use super::InfraIdParam;
use crate::error::Result;
use crate::views::AuthenticationExt;
use editoast_models::Infra;
use editoast_models::infra::ObjectQueryable;
use editoast_models::prelude::*;

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
pub(in crate::views) struct ObjectTypeParam {
    object_type: ObjectType,
}

/// Retrieves specific infra objects
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam, ObjectTypeParam),
    request_body = Vec<String>,
    responses(
        (status = 200, description = "The list of objects", body = Vec<ObjectQueryable>),
        (status = 400, description = "Duplicate object ids provided"),
        (status = 404, description = "Object ID or infra ID invalid")
    )
)]
pub(in crate::views) async fn get_objects(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Path(object_type_param): Path<ObjectTypeParam>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(obj_ids): Json<Vec<String>>,
) -> Result<Json<Vec<ObjectQueryable>>> {
    if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(
                &authz::Infra(infra_id),
                authz::InfraPrivilege::CanRestrictedRead,
            )
            .await
    })
    .await?;

    let objects = infra
        .get_objects(
            &mut db_pool.get().await?,
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

#[derive(serde::Serialize, utoipa::ToSchema)]
pub(in crate::views) struct ListObjectsResponse {
    ids: Vec<String>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam, ObjectTypeParam),
    responses(
        (status = 200, description = "The list of objects", body = inline(ListObjectsResponse)),
    )
)]
pub(in crate::views) async fn list_objects_ids(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Path(ObjectTypeParam { object_type }): Path<ObjectTypeParam>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<ListObjectsResponse>> {
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(
                &authz::Infra(infra_id),
                authz::InfraPrivilege::CanRestrictedRead,
            )
            .await
    })
    .await?;

    let objects = infra
        .list_objects(&mut db_pool.get().await?, object_type)
        .await?;

    Ok(Json(ListObjectsResponse { ids: objects }))
}

#[cfg(test)]
mod tests {
    use authz::InfraGrant;
    use pretty_assertions::assert_eq;

    use schemas::primitives::Identifier;
    use serde_json::Value as JsonValue;
    use serde_json::json;

    use crate::fixtures::create_empty_infra;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::views::infra::objects::ObjectQueryable;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use schemas::infra::Switch;
    use schemas::infra::SwitchType;
    use schemas::primitives::OSRDIdentified;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn check_invalid_ids() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        app.post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&["invalid_id"])
            .await
            .assert_status_bad_request();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_objects_no_ids() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        app.post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&vec![""; 0])
            .await
            .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_objects_should_return_switch() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let switch = Switch {
            id: "switch_001".into(),
            switch_type: "switch_type_001".into(),
            ..Default::default()
        };
        apply_create_operation(
            &switch.clone().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
        )
        .await
        .expect("Failed to create switch object");

        // WHEN

        // THEN
        let switch_object: Vec<ObjectQueryable> = app
            .post(format!("/infra/{}/objects/Switch", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&vec!["switch_001"])
            .await
            .assert_status_ok()
            .json();
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_objects_duplicate_ids() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        app.post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&vec!["id"; 2])
            .await
            .assert_status_bad_request();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_switch_types() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        // Add a switch type
        let switch_type = SwitchType::default();
        apply_create_operation(
            &switch_type.clone().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
        )
        .await
        .expect("Failed to create switch type object");

        let switch_type_object: Vec<ObjectQueryable> = app
            .post(format!("/infra/{}/objects/SwitchType", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&vec![switch_type.id.clone()])
            .await
            .assert_status_ok()
            .json();
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_list_ids() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        // Add two switch types
        let switch_type_a = SwitchType {
            id: Identifier("A".to_string()),
            ..Default::default()
        };
        apply_create_operation(&switch_type_a.into(), empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create switch type object");

        let switch_type_b = SwitchType {
            id: Identifier("B".to_string()),
            ..Default::default()
        };
        apply_create_operation(&switch_type_b.into(), empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create switch type object");

        let response = app
            .get(format!("/infra/{}/objects/SwitchType/ids", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json::<JsonValue>();

        assert!(matches!(response, JsonValue::Object(_)));
        let mut ids = response
            .get("ids")
            .expect("ids isn't present in response")
            .as_array()
            .expect("ids isn't an array")
            .iter()
            .map(|id| id.as_str().expect("id isn't a string"))
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, vec!["A", "B"]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn object_endpoints_require_can_read() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app.user("user", "User").create().await;

        app.post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&Vec::<String>::new())
            .await
            .assert_status_forbidden();

        app.get(format!("/infra/{}/objects/TrackSection/ids", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();
    }
}
