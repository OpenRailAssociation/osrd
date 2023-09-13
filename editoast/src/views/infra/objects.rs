use std::collections::HashMap;

use actix_web::post;
use actix_web::web::{Data, Json, Path};
use diesel::sql_types::{Array, BigInt, Jsonb, Nullable, Text};
use diesel::{sql_query, QueryableByName};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::schema::ObjectType;
use crate::{routes, DbPool};
use editoast_derive::EditoastError;

routes! {
    get_objects
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:objects")]
enum GetObjectsErrors {
    #[error("Duplicate object ids provided")]
    DuplicateIdsProvided,
    #[error("Object id '{0}' not found")]
    ObjectIdNotFound(String),
}

/// Return whether the list of ids contains unique values or has duplicate
fn has_unique_ids(obj_ids: &Vec<String>) -> bool {
    let mut obj_ids_2 = obj_ids.clone();
    obj_ids_2.sort();
    obj_ids_2.dedup();
    obj_ids_2.len() == obj_ids.len()
}

// The schema is build that way because I couldn't achieve this (admitedly strange)
// structure using the derive macro ToSchema.
fn untyped_railjson_object() -> utoipa::openapi::Object {
    utoipa::openapi::ObjectBuilder::new()
        .description(Some("This field follows railjson format"))
        .additional_properties(Some(
            utoipa::openapi::schema::AdditionalProperties::FreeForm(true),
        ))
        .property("id", <String as utoipa::PartialSchema>::schema())
        .required("id")
        .example(Some(json!({
            "id": "bd840b06-84ba-4566-98c1-ccf0196c5f16",
            "geo": {
                "type": "LineString",
                "coordinates": [[1, 41], [2, 42]]
            },
            "sch": {
                "type": "LineString",
                "coordinates": [[1, 41], [2, 42]]
            },
            "curves": [],
            "length": 1000,
            "slopes": [
                {
                    "end": 500,
                    "begin": 250,
                    "gradient": -1
                }
            ],
            "line_code": 1,
            "line_name": "my line",
            "track_name": "track name",
            "navigability": "BOTH",
            "track_number": 1
        })))
        .build()
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, ToSchema)]
struct ObjectQueryable {
    #[diesel(sql_type = Text)]
    #[serde(skip_serializing)]
    obj_id: String,
    /// Object properties in railjson format
    #[diesel(sql_type = Jsonb)]
    #[schema(schema_with = untyped_railjson_object)]
    railjson: JsonValue,
    /// object's geographic in geojson format
    #[diesel(sql_type = Nullable<Jsonb>)]
    #[schema(value_type = GeometryValue)]
    geographic: Option<JsonValue>,
    /// object's schematic in geojson format
    #[diesel(sql_type = Nullable<Jsonb>)]
    #[schema(value_type = GeometryValue)]
    schematic: Option<JsonValue>,
}

/// Return the railjson list of a specific OSRD object
#[utoipa::path(
    params(super::InfraId),
    responses(
        (status = 200, description = "The list of objects", body = inline(Vec<ObjectQueryable>)),
    ),
)]
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
    use actix_web::test::{call_service, TestRequest};

    use crate::fixtures::tests::{empty_infra, TestFixture};
    use crate::models::Infra;
    use crate::schema::SwitchType;
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
