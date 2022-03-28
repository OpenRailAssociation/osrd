use super::{ObjectType, TrackSection};
use crate::response::ApiError;
use diesel::sql_types::{Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::serde::Deserialize;
use serde_json::Value;

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde", tag = "obj_type")]
pub enum CreateOperation {
    TrackSection { railjson: TrackSection },
}

impl CreateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
        sql_query(format!(
            "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
            self.get_obj_type().get_table()
        ))
        .bind::<Integer, _>(infra_id)
        .bind::<Text, _>(self.get_obj_id())
        .bind::<Json, _>(self.get_data())
        .execute(conn)
        .unwrap();
        Ok(())
    }

    pub fn get_obj_type(&self) -> ObjectType {
        match self {
            CreateOperation::TrackSection { railjson: _ } => ObjectType::TrackSection,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            CreateOperation::TrackSection { railjson } => railjson.id.clone(),
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            CreateOperation::TrackSection { railjson } => serde_json::to_value(railjson).unwrap(),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use diesel::result::Error;
    use diesel::{Connection, PgConnection};

    use super::CreateOperation;
    use crate::railjson::TrackSection;

    #[test]
    fn create_track() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let track_creation = CreateOperation::TrackSection {
                railjson: TrackSection {
                    id: "my_track".to_string(),
                    length: 100.,
                    line_name: "line_test".to_string(),
                    track_name: "track_test".to_string(),
                    ..Default::default()
                },
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();

            assert!(track_creation.apply(infra.id, &conn).is_ok());
            Ok(())
        });
    }
}
