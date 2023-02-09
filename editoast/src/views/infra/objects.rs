use std::collections::HashMap;

use actix_web::dev::HttpServiceFactory;
use actix_web::http::StatusCode;
use actix_web::post;
use actix_web::web::{block, Data, Json, Path};
use diesel::sql_types::{Array, BigInt, Jsonb, Nullable, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

use crate::error::{EditoastError, Result};
use crate::schema::ObjectType;
use crate::DbPool;

/// Return `/infra/<infra_id>/objects` routes
pub fn routes() -> impl HttpServiceFactory {
    get_objects
}

#[derive(Debug, Error)]
enum GetObjectsErrors {
    #[error("Duplicate object ids provided")]
    DuplicateIdsProvided,
    #[error("Object id '{0}' not found")]
    ObjectIdNotFound(String),
}

impl EditoastError for GetObjectsErrors {
    fn get_status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }

    fn get_type(&self) -> &'static str {
        match self {
            GetObjectsErrors::DuplicateIdsProvided => "editoast:infra:objects:DuplicateIdsProvided",
            GetObjectsErrors::ObjectIdNotFound { .. } => "editoast:infra:objects:ObjectIdNotFound",
        }
    }
}

/// Return whether the list of ids contains unique values or has duplicate
fn has_unique_ids(obj_ids: &Vec<String>) -> bool {
    let mut obj_ids_2 = obj_ids.clone();
    obj_ids_2.sort();
    obj_ids_2.dedup();
    obj_ids_2.len() == obj_ids.len()
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct ObjectQueryable {
    #[diesel(sql_type = Text)]
    #[serde(skip_serializing)]
    obj_id: String,
    #[diesel(sql_type = Jsonb)]
    railjson: JsonValue,
    #[diesel(sql_type = Nullable<Jsonb>)]
    geographic: Option<JsonValue>,
    #[diesel(sql_type = Nullable<Jsonb>)]
    schematic: Option<JsonValue>,
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
            ObjectType::get_table(&obj_type)
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
            ObjectType::get_table(&obj_type),
            ObjectType::get_geometry_layer_table(&obj_type).unwrap()
        )
    };

    // Execute query
    let obj_ids_dup = obj_ids.clone();
    let objects: Vec<ObjectQueryable> = block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        sql_query(query)
            .bind::<BigInt, _>(infra)
            .bind::<Array<Text>, _>(obj_ids_dup)
            .load(&mut conn)
    })
    .await
    .unwrap()?;

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
        return Err(GetObjectsErrors::ObjectIdNotFound(not_found_id.clone()).into());
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
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};

    use crate::infra::Infra;
    use crate::schema::SwitchType;
    use crate::views::infra::tests::{
        create_infra_request, create_object_request, delete_infra_request,
    };
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn check_invalid_ids() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_objects_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", infra.id).as_str())
            .set_json(["invalid_id"])
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn get_objects_no_ids() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_objects_no_id_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", infra.id).as_str())
            .set_json(vec![""; 0])
            .to_request();
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn get_objects_duplicate_ids() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_objects_dup_ids_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", infra.id).as_str())
            .set_json(vec!["id"; 2])
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn get_switch_types() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_switch_types_test")).await;

        // Add a switch type
        let switch_type = SwitchType::default();
        let switch_id = switch_type.id.clone();
        let req = create_object_request(infra.id, switch_type.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/SwitchType", infra.id).as_str())
            .set_json(vec![switch_id])
            .to_request();
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
