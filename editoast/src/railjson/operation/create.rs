use super::ObjectType;
use crate::error::ApiError;
use crate::railjson::TrackSection;
use diesel::sql_types::{Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum RailjsonObject {
    TrackSection { railjson: TrackSection },
}

pub fn apply_create_operation(
    railjson_object: &RailjsonObject,
    infra_id: i32,
    conn: &PgConnection,
) -> Result<(), Box<dyn ApiError>> {
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        railjson_object.get_obj_type().get_table()
    ))
    .bind::<Integer, _>(infra_id)
    .bind::<Text, _>(railjson_object.get_obj_id())
    .bind::<Json, _>(railjson_object.get_data())
    .execute(conn)
    .unwrap();
    Ok(())
}

impl RailjsonObject {
    pub fn get_obj_type(&self) -> ObjectType {
        match self {
            RailjsonObject::TrackSection { railjson: _ } => ObjectType::TrackSection,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            RailjsonObject::TrackSection { railjson } => railjson.id.clone(),
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            RailjsonObject::TrackSection { railjson } => serde_json::to_value(railjson).unwrap(),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use crate::railjson::operation::create::{apply_create_operation, RailjsonObject};
    use diesel::result::Error;
    use diesel::{Connection, PgConnection};

    use crate::railjson::TrackSection;

    #[test]
    fn create_track() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let track_creation = RailjsonObject::TrackSection {
                railjson: TrackSection {
                    id: "my_track".to_string(),
                    length: 100.,
                    line_name: "line_test".to_string(),
                    track_name: "track_test".to_string(),
                    ..Default::default()
                },
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();

            assert!(apply_create_operation(&track_creation, infra.id, &conn).is_ok());
            Ok(())
        });
    }
}
