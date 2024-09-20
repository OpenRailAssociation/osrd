use std::collections::HashMap;
use std::collections::HashSet;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::primitives::ObjectType;
use editoast_schemas::train_schedule::PathItemLocation;
use thiserror::Error;

use super::InfraApiError;
use super::InfraIdParam;
use crate::error::Result;
use crate::models::infra::ObjectQueryable;
use crate::models::Infra;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::Retrieve;

const CH_BV: &str = "BV";
const CH_00: &str = "00";

crate::routes! {
    "/objects/{object_type}" => get_objects,
    "/check-locations" => check_locations,
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
    Extension(authorizer): AuthorizerExt,
    Json(obj_ids): Json<Vec<String>>,
) -> Result<Json<Vec<ObjectQueryable>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let infra_id = infra_id_param.infra_id;
    if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
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

#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = Vec<PathItemLocation>,
    responses(
        (status = 200, description = "The list of locations", body = HashMap<String,  InfraObjectWithGeometry>),
    )
)]
async fn check_locations(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(infra_id_param): Path<InfraIdParam>,
    Json(path_item_locations): Json<Vec<PathItemLocation>>,
) -> Result<Json<HashMap<String, ObjectQueryable>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let infra_id = infra_id_param.infra_id;
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    let mut results = HashMap::new();

    for location in path_item_locations {
        match location {
            PathItemLocation::TrackOffset(track) => {
                let ts_object = infra
                    .get_ts_object_with_length(
                        &mut db_pool.get().await?,
                        track.track.as_ref(),
                        track.offset as f64,
                    )
                    .await
                    .ok();
                if let Some(track_section) = ts_object {
                    results.insert(track.track.to_string(), track_section);
                }
            }
            PathItemLocation::OperationalPointId { operational_point } => {
                let op_objects = infra
                    .get_objects(
                        &mut db_pool.get().await?,
                        ObjectType::OperationalPoint,
                        &vec![operational_point.to_string()],
                    )
                    .await?;
                if let Some(op) = op_objects.first() {
                    results.insert(operational_point.to_string(), op.clone());
                }
            }
            PathItemLocation::OperationalPointDescription {
                trigram,
                secondary_code,
            } => {
                let op_objects = infra
                    .get_op_objects_by_trigram(&mut db_pool.get().await?, trigram.as_ref())
                    .await?;
                if let Some(op_obj) = find_op_obj_by_secondary_code(op_objects, secondary_code) {
                    results.insert(trigram.to_string(), op_obj);
                }
            }
            PathItemLocation::OperationalPointUic {
                uic,
                secondary_code,
            } => {
                let op_objects = infra
                    .get_op_objects_by_uic(&mut db_pool.get().await?, uic as i64)
                    .await?;
                if let Some(op_obj) = find_op_obj_by_secondary_code(op_objects, secondary_code) {
                    results.insert(uic.to_string(), op_obj);
                }
            }
        }
    }

    Ok(Json(results))
}

fn filter_operational_point_by_ch(
    operational_point_objects: Vec<ObjectQueryable>,
    secondary_code: &str,
) -> Option<ObjectQueryable> {
    for op_obj in operational_point_objects {
        if let Ok(op) = OperationalPoint::from_railjson(op_obj.railjson.clone()) {
            if op.matches_ch(secondary_code) {
                return Some(op_obj);
            }
        }
    }
    None
}

fn find_op_obj_by_secondary_code(
    operational_point_objects: Vec<ObjectQueryable>,
    secondary_code: Option<String>,
) -> Option<ObjectQueryable> {
    if operational_point_objects.is_empty() {
        return None;
    }
    if let Some(secondary_code) = secondary_code {
        filter_operational_point_by_ch(operational_point_objects, &secondary_code)
    } else if let Some(op_obj) =
        filter_operational_point_by_ch(operational_point_objects.clone(), CH_BV)
    {
        Some(op_obj)
    } else if let Some(op_obj) =
        filter_operational_point_by_ch(operational_point_objects.clone(), CH_00)
    {
        Some(op_obj)
    } else {
        Some(operational_point_objects.first().unwrap().clone())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use editoast_schemas::infra::InfraObject;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::OperationalPointExtensions;
    use editoast_schemas::infra::OperationalPointSncfExtension;
    use editoast_schemas::infra::TrackOffset;
    use editoast_schemas::train_schedule::PathItemLocation;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use serde_json::Value as JsonValue;

    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_small_infra;
    use crate::views::infra::objects::ObjectQueryable;
    use crate::views::infra::objects::CH_00;
    use crate::views::infra::objects::CH_BV;
    use crate::views::test_app::TestAppBuilder;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::primitives::OSRDIdentified;

    #[rstest]
    async fn check_invalid_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .json(&["invalid_id"]);

        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_objects_no_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

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
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

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
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/objects/TrackSection", empty_infra.id).as_str())
            .json(&vec!["id"; 2]);

        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn get_switch_types() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        // Add a switch type
        let switch_type = SwitchType::default();
        apply_create_operation(
            &switch_type.clone().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
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

    #[rstest]
    async fn test_check_locations_success() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/check-locations", small_infra.id).as_str())
            .json(&vec![
                PathItemLocation::TrackOffset(TrackOffset {
                    track: "TA1".into(),
                    offset: 600,
                }),
                PathItemLocation::OperationalPointId {
                    operational_point: "South_West_station".into(),
                },
                PathItemLocation::OperationalPointDescription {
                    trigram: "WS".into(),
                    secondary_code: None,
                },
                PathItemLocation::OperationalPointUic {
                    uic: 4,
                    secondary_code: None,
                },
            ]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(res.get("TA1").unwrap().clone().unwrap().obj_id, "TA1");
        assert_eq!(
            res.get("South_West_station")
                .unwrap()
                .clone()
                .unwrap()
                .obj_id,
            "South_West_station"
        );
        assert_eq!(
            res.get("WS").unwrap().clone().unwrap().obj_id,
            "West_station"
        );
        assert_eq!(
            res.get("4").unwrap().clone().unwrap().obj_id,
            "Mid_East_station"
        );
    }

    #[rstest]
    async fn check_locations_return_none_when_offset_gt_ts_length() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/check-locations", small_infra.id).as_str())
            .json(&vec![PathItemLocation::TrackOffset(TrackOffset {
                track: "TA1".into(),
                offset: 1_000_000,
            })]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(res.is_empty());
    }

    #[rstest]
    async fn check_locations_return_none_when_op_id_does_not_exist() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/check-locations", small_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointId {
                operational_point: "DOES_NOT_EXIST".into(),
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(res.is_empty());
    }

    #[rstest]
    async fn check_locations_return_none_when_trigram_does_not_exist() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/check-locations", small_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointDescription {
                trigram: "DOES_NOT_EXIST".into(),
                secondary_code: None,
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(res.is_empty());
    }

    #[rstest]
    async fn check_locations_return_none_when_uic_does_not_exist() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/check-locations", small_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointUic {
                uic: 1_000_000,
                secondary_code: None,
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(res.is_empty());
    }

    fn op_obj(trigram: String, ch: String) -> InfraObject {
        OperationalPoint {
            extensions: OperationalPointExtensions {
                sncf: Some(OperationalPointSncfExtension {
                    trigram,
                    ch,
                    ..Default::default()
                }),
                ..Default::default()
            },
            ..Default::default()
        }
        .into()
    }

    #[rstest]
    async fn check_locations_return_op_with_ch_bv() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        for obj in [
            &op_obj("AAA".to_string(), CH_00.to_string()),
            &op_obj("AAA".to_string(), CH_BV.to_string()),
        ] {
            apply_create_operation(obj, empty_infra.id, &mut db_pool.get_ok())
                .await
                .expect("Failed to create object");
        }

        let request = app
            .post(format!("/infra/{}/check-locations", empty_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointDescription {
                trigram: "AAA".into(),
                secondary_code: None,
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let op = OperationalPoint::from_railjson(res.get("AAA").unwrap().clone().unwrap().railjson);

        assert_eq!(op.unwrap().extensions.sncf.unwrap().ch, CH_BV.to_string());
    }

    #[rstest]
    async fn check_locations_return_op_with_ch_00() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        for obj in [
            &op_obj("AAA".to_string(), CH_00.to_string()),
            &op_obj("AAA".to_string(), "BB".to_string()),
        ] {
            apply_create_operation(obj, empty_infra.id, &mut db_pool.get_ok())
                .await
                .expect("Failed to create object");
        }

        let request = app
            .post(format!("/infra/{}/check-locations", empty_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointDescription {
                trigram: "AAA".into(),
                secondary_code: None,
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let op = OperationalPoint::from_railjson(res.get("AAA").unwrap().clone().unwrap().railjson);

        assert_eq!(op.unwrap().extensions.sncf.unwrap().ch, CH_00.to_string());
    }

    #[rstest]
    async fn check_locations_return_op_with_ch_cc() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        for obj in [&op_obj("AAA".to_string(), "CC".to_string())] {
            apply_create_operation(obj, empty_infra.id, &mut db_pool.get_ok())
                .await
                .expect("Failed to create object");
        }

        let request = app
            .post(format!("/infra/{}/check-locations", empty_infra.id).as_str())
            .json(&vec![PathItemLocation::OperationalPointDescription {
                trigram: "AAA".into(),
                secondary_code: None,
            }]);

        let res: HashMap<String, Option<ObjectQueryable>> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let op = OperationalPoint::from_railjson(res.get("AAA").unwrap().clone().unwrap().railjson);

        assert_eq!(op.unwrap().extensions.sncf.unwrap().ch, "CC".to_string());
    }
}
