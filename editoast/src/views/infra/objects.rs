use std::collections::HashMap;

use crate::api_error::ApiError;
use crate::{api_error::ApiResult, db_connection::DBConnection, schema::ObjectType};
use diesel::sql_types::{Array, BigInt, Jsonb, Nullable, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{Error as JsonError, Json, Value as JsonValue};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Return the endpoints routes of this module
pub fn routes() -> Vec<rocket::Route> {
    routes![get_objects]
}

#[derive(Debug, Error)]
enum GetObjectsErrors {
    #[error("No object ids provided")]
    NoObjectIdsProvided,
    #[error("Duplicate object ids provided")]
    DuplicateIdsProvided,
    #[error("Object id '{0}' not found")]
    ObjectIdNotFound(String),
}

impl ApiError for GetObjectsErrors {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        match self {
            GetObjectsErrors::NoObjectIdsProvided => "editoast:infra:objects:NoObjectIdsProvided",
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
#[post("/<infra>/objects/<object_type>", data = "<obj_ids>")]
async fn get_objects(
    infra: i64,
    object_type: ObjectType,
    obj_ids: Result<Json<Vec<String>>, JsonError<'_>>,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    let obj_ids = obj_ids?.0;
    if obj_ids.is_empty() {
        return Err(GetObjectsErrors::NoObjectIdsProvided.into());
    } else if !has_unique_ids(&obj_ids) {
        return Err(GetObjectsErrors::DuplicateIdsProvided.into());
    }

    // Prepare query
    let query = if object_type == ObjectType::SwitchType {
        format!(
            "SELECT obj_id as obj_id, data as railjson, NULL as geographic, NULL as schematic
                FROM {} WHERE infra_id = $1 AND obj_id = ANY($2) ",
            ObjectType::get_table(&object_type)
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
            ObjectType::get_table(&object_type),
            ObjectType::get_geometry_layer_table(&object_type).unwrap()
        )
    };

    // Execute query
    let obj_ids_dup = obj_ids.clone();
    let objects: Vec<ObjectQueryable> = conn
        .run(move |conn| {
            sql_query(query)
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(obj_ids_dup)
                .load(conn)
        })
        .await?;

    // Build a cache to reorder the result
    let mut objects: HashMap<_, _> = objects
        .into_iter()
        .map(|obj| (obj.obj_id.clone(), obj))
        .collect();

    // Check all objects exist
    if objects.len() != obj_ids.len() {
        let not_found_id = obj_ids
            .into_iter()
            .find(|obj_id| !objects.contains_key(obj_id))
            .unwrap();
        return Err(GetObjectsErrors::ObjectIdNotFound(not_found_id).into());
    }

    // Reorder the result to match the order of the input
    let mut result = vec![];
    obj_ids.iter().for_each(|obj_id| {
        result.push(objects.remove(obj_id).unwrap());
    });
    Ok(Custom(Status::Ok, serde_json::to_value(result).unwrap()))
}

#[cfg(test)]
mod tests {
    use rocket::http::{ContentType, Status};

    use crate::infra::Infra;
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::SwitchType;
    use crate::views::tests::create_test_client;

    #[test]
    fn check_invalid_ids() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"Get Objects"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let get_objects = client
            .post(format!("/infra/{}/objects/TrackSection", infra.id))
            .header(ContentType::JSON)
            .body(r#"["invalid_id"]"#)
            .dispatch();
        assert_eq!(get_objects.status(), Status::BadRequest);
    }
    #[test]
    fn get_objects_no_ids() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"Get Objects"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let get_objects = client
            .post(format!("/infra/{}/objects/TrackSection", infra.id))
            .header(ContentType::JSON)
            .body(r#"[]"#)
            .dispatch();
        assert_eq!(get_objects.status(), Status::BadRequest);
    }

    #[test]
    fn get_objects_duplicate_ids() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"Get Objects"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let get_objects = client
            .post(format!("/infra/{}/objects/TrackSection", infra.id))
            .header(ContentType::JSON)
            .body(r#"["id","id"]"#)
            .dispatch();
        assert_eq!(get_objects.status(), Status::BadRequest);
    }

    #[test]
    fn get_switch_types() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"Get Objects"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let switch_type = SwitchType::default();
        let operation = Operation::Create(Box::new(RailjsonObject::SwitchType {
            railjson: switch_type.clone(),
        }));
        let create_switch_type = client
            .post(format!("/infra/{}/", infra.id))
            .header(ContentType::JSON)
            .body(serde_json::to_string(&vec![operation]).unwrap())
            .dispatch();
        assert_eq!(create_switch_type.status(), Status::Ok);

        let get_objects = client
            .post(format!("/infra/{}/objects/SwitchType", infra.id))
            .header(ContentType::JSON)
            .body(format!(r#"["{}"]"#, switch_type.id))
            .dispatch();
        assert_eq!(get_objects.status(), Status::Ok);
    }
}
