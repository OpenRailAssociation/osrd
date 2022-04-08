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
pub mod test {
    use crate::models::infra::test::test_transaction;
    use crate::railjson::operation::create::{apply_create_operation, RailjsonObject};
    use crate::railjson::{Signal, SpeedSection, TrackSection};
    use diesel::PgConnection;

    pub fn create_track(conn: &PgConnection, infra_id: i32, track: TrackSection) -> RailjsonObject {
        let obj = RailjsonObject::TrackSection { railjson: track };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_signal(conn: &PgConnection, infra_id: i32, signal: Signal) -> RailjsonObject {
        let obj = RailjsonObject::Signal { railjson: signal };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_speed(conn: &PgConnection, infra_id: i32, speed: SpeedSection) -> RailjsonObject {
        let obj = RailjsonObject::SpeedSection { railjson: speed };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    #[test]
    fn create_track_test() {
        test_transaction(|conn, infra| {
            create_track(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_signal_test() {
        test_transaction(|conn, infra| {
            create_signal(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_speed_test() {
        test_transaction(|conn, infra| {
            create_speed(conn, infra.id, Default::default());
        });
    }
}
