use crate::error::ApiError;
use crate::railjson::{ObjectRef, ObjectType, Signal, SpeedSection, TrackSection};
use diesel::sql_types::{Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum RailjsonObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    SpeedSection { railjson: SpeedSection },
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
            RailjsonObject::Signal { railjson: _ } => ObjectType::Signal,
            RailjsonObject::SpeedSection { railjson: _ } => ObjectType::SpeedSection,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            RailjsonObject::TrackSection { railjson } => railjson.id.clone(),
            RailjsonObject::Signal { railjson } => railjson.id.clone(),
            RailjsonObject::SpeedSection { railjson } => railjson.id.clone(),
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            RailjsonObject::TrackSection { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::Signal { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::SpeedSection { railjson } => serde_json::to_value(railjson).unwrap(),
        }
    }

    pub fn get_ref(&self) -> ObjectRef {
        ObjectRef::new(self.get_obj_type(), self.get_obj_id())
    }
}

#[cfg(test)]
mod test {
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use crate::railjson::operation::create::{apply_create_operation, RailjsonObject};
    use crate::railjson::{Signal, SpeedSection, TrackSection};
    use diesel::result::Error;
    use diesel::{Connection, PgConnection};

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

    #[test]
    fn create_signal() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let signal_creation = RailjsonObject::Signal {
                railjson: Signal {
                    ..Default::default()
                },
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();

            assert!(apply_create_operation(&signal_creation, infra.id, &conn).is_ok());
            Ok(())
        });
    }

    #[test]
    fn create_speedsection() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let speed_creation = RailjsonObject::SpeedSection {
                railjson: SpeedSection {
                    id: "my_speed".to_string(),
                    speed: 100.0,
                    track_ranges: vec![],
                },
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();

            assert!(apply_create_operation(&speed_creation, infra.id, &conn).is_ok());
            Ok(())
        });
    }
}
