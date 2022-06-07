use crate::error::ApiError;
use crate::railjson::{
    BufferStop, Detector, ObjectRef, ObjectType, OperationalPoint, Route, Signal, SpeedSection,
    Switch, SwitchType, TrackSection, TrackSectionLink,
};
use diesel::sql_types::{Integer, Json, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::OperationError;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum RailjsonObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    SpeedSection { railjson: SpeedSection },
    TrackSectionLink { railjson: TrackSectionLink },
    Switch { railjson: Switch },
    SwitchType { railjson: SwitchType },
    Detector { railjson: Detector },
    BufferStop { railjson: BufferStop },
    Route { railjson: Route },
    OperationalPoint { railjson: OperationalPoint },
}

pub fn apply_create_operation(
    railjson_object: &RailjsonObject,
    infra_id: i32,
    conn: &PgConnection,
) -> Result<(), Box<dyn ApiError>> {
    let obj_id = railjson_object.get_obj_id();
    if obj_id.is_empty() {
        return Err(Box::new(OperationError::EmptyId));
    }
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
            RailjsonObject::TrackSectionLink { railjson: _ } => ObjectType::TrackSectionLink,
            RailjsonObject::Switch { railjson: _ } => ObjectType::Switch,
            RailjsonObject::SwitchType { railjson: _ } => ObjectType::SwitchType,
            RailjsonObject::Detector { railjson: _ } => ObjectType::Detector,
            RailjsonObject::BufferStop { railjson: _ } => ObjectType::BufferStop,
            RailjsonObject::Route { railjson: _ } => ObjectType::Route,
            RailjsonObject::OperationalPoint { railjson: _ } => ObjectType::OperationalPoint,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            RailjsonObject::TrackSection { railjson } => railjson.id.clone(),
            RailjsonObject::Signal { railjson } => railjson.id.clone(),
            RailjsonObject::SpeedSection { railjson } => railjson.id.clone(),
            RailjsonObject::TrackSectionLink { railjson } => railjson.id.clone(),
            RailjsonObject::Switch { railjson } => railjson.id.clone(),
            RailjsonObject::SwitchType { railjson } => railjson.id.clone(),
            RailjsonObject::Detector { railjson } => railjson.id.clone(),
            RailjsonObject::BufferStop { railjson } => railjson.id.clone(),
            RailjsonObject::Route { railjson } => railjson.id.clone(),
            RailjsonObject::OperationalPoint { railjson } => railjson.id.clone(),
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            RailjsonObject::TrackSection { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::Signal { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::SpeedSection { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::TrackSectionLink { railjson } => {
                serde_json::to_value(railjson).unwrap()
            }
            RailjsonObject::Switch { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::SwitchType { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::Detector { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::BufferStop { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::Route { railjson } => serde_json::to_value(railjson).unwrap(),
            RailjsonObject::OperationalPoint { railjson } => {
                serde_json::to_value(railjson).unwrap()
            }
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
    use crate::railjson::{
        BufferStop, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch, SwitchType,
        TrackSection, TrackSectionLink,
    };
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

    pub fn create_link(
        conn: &PgConnection,
        infra_id: i32,
        link: TrackSectionLink,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSectionLink { railjson: link };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_switch(conn: &PgConnection, infra_id: i32, switch: Switch) -> RailjsonObject {
        let obj = RailjsonObject::Switch { railjson: switch };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_detector(
        conn: &PgConnection,
        infra_id: i32,
        detector: Detector,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Detector { railjson: detector };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_buffer_stop(
        conn: &PgConnection,
        infra_id: i32,
        buffer_stop: BufferStop,
    ) -> RailjsonObject {
        let obj = RailjsonObject::BufferStop {
            railjson: buffer_stop,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_route(conn: &PgConnection, infra_id: i32, route: Route) -> RailjsonObject {
        let obj = RailjsonObject::Route { railjson: route };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_op(conn: &PgConnection, infra_id: i32, op: OperationalPoint) -> RailjsonObject {
        let obj = RailjsonObject::OperationalPoint { railjson: op };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_st(conn: &PgConnection, infra_id: i32, st: SwitchType) -> RailjsonObject {
        let obj = RailjsonObject::SwitchType { railjson: st };
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

    #[test]
    fn create_link_test() {
        test_transaction(|conn, infra| {
            create_link(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_switch_test() {
        test_transaction(|conn, infra| {
            create_switch(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_detector_test() {
        test_transaction(|conn, infra| {
            create_detector(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_buffer_stop_test() {
        test_transaction(|conn, infra| {
            create_buffer_stop(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_route_test() {
        test_transaction(|conn, infra| {
            create_route(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_op_test() {
        test_transaction(|conn, infra| {
            create_op(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_st_test() {
        test_transaction(|conn, infra| {
            create_st(conn, infra.id, Default::default());
        });
    }
}
