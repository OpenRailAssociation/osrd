use std::collections::{HashMap, HashSet};

use actix_web::dev::HttpServiceFactory;
use actix_web::post;
use actix_web::web::{Data, Json, Path};
use diesel::sql_types::{Array, BigInt, Jsonb, Nullable, Text};
use diesel::{sql_query, QueryableByName};
use diesel_async::RunQueryDsl;
use diesel_json::Json as DieselJson;
use editoast_schemas::geo_json::GeoJson;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

use crate::error::Result;
use crate::modelsv2::{get_geometry_layer_table, get_table};
use crate::schema::ObjectType;
use crate::DbPool;
use editoast_derive::EditoastError;

/// Return `/infra/<infra_id>/objects` routes
pub fn routes() -> impl HttpServiceFactory {
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

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, PartialEq)]
struct ObjectQueryable {
    #[diesel(sql_type = Text)]
    obj_id: String,
    #[diesel(sql_type = Jsonb)]
    railjson: JsonValue,
    #[diesel(sql_type = Nullable<Jsonb>)]
    geographic: Option<DieselJson<GeoJson>>,
    #[diesel(sql_type = Nullable<Jsonb>)]
    schematic: Option<DieselJson<GeoJson>>,
}

/// Return the railjson list of a specific OSRD object
#[post("/objects/{object_type}")]
async fn get_objects(
    path_params: Path<(i64, ObjectType)>,
    obj_ids: Json<Vec<String>>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<ObjectQueryable>>> {
    let (infra, obj_type) = path_params.into_inner();
    if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    // Prepare query
    let query = if [ObjectType::SwitchType, ObjectType::Route].contains(&obj_type) {
        format!(
            "SELECT obj_id as obj_id, data as railjson, NULL as geographic, NULL as schematic
                FROM {} WHERE infra_id = $1 AND obj_id = ANY($2) ",
            get_table(&obj_type)
        )
    } else {
        format!("
            SELECT
                object_table.obj_id as obj_id,
                object_table.data as railjson,
                ST_AsGeoJSON(ST_Transform(geographic, 4326))::jsonb as geographic,
                ST_AsGeoJSON(ST_Transform(schematic, 4326))::jsonb as schematic
            FROM {} AS object_table
            LEFT JOIN {} AS geometry_table ON object_table.obj_id = geometry_table.obj_id AND object_table.infra_id = geometry_table.infra_id
            WHERE object_table.infra_id = $1 AND object_table.obj_id = ANY($2)
            ",
            get_table(&obj_type),
            get_geometry_layer_table(&obj_type).unwrap()
        )
    };

    // Execute query
    let obj_ids_dup = obj_ids.clone();
    let mut conn = db_pool.get().await?;
    let objects: Vec<ObjectQueryable> = sql_query(query)
        .bind::<BigInt, _>(infra)
        .bind::<Array<Text>, _>(obj_ids_dup)
        .load(&mut conn)
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
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use serde_json::{json, Value as JsonValue};

    use crate::fixtures::tests::{db_pool, empty_infra, TestFixture};
    use crate::modelsv2::Infra;
    use crate::schema::operation::Operation;
    use crate::schema::OSRDIdentified;
    use crate::schema::{Switch, SwitchType};
    use crate::views::infra::objects::ObjectQueryable;
    use crate::views::infra::tests::create_object_request;
    use crate::views::tests::create_test_service;
    use rstest::*;

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
            schematic: None,
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
