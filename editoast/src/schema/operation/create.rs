use crate::api_error::ApiError;
use crate::schema::{
    BufferStop, Catenary, Detector, OSRDIdentified, OSRDObject, ObjectType, OperationalPoint,
    Route, Signal, SpeedSection, Switch, SwitchType, TrackSection, TrackSectionLink,
};
use diesel::sql_types::{BigInt, Json, Text};
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
    Catenary { railjson: Catenary },
}

pub fn apply_create_operation(
    railjson_object: &RailjsonObject,
    infra_id: i64,
    conn: &mut PgConnection,
) -> Result<(), Box<dyn ApiError>> {
    if railjson_object.get_id().is_empty() {
        return Err(Box::new(OperationError::EmptyId));
    }
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        railjson_object.get_type().get_table()
    ))
    .bind::<BigInt, _>(infra_id)
    .bind::<Text, _>(railjson_object.get_id())
    .bind::<Json, _>(railjson_object.get_data())
    .execute(conn)
    .unwrap();
    Ok(())
}

impl OSRDIdentified for RailjsonObject {
    fn get_id(&self) -> &String {
        self.get_obj().get_id()
    }
}

impl OSRDObject for RailjsonObject {
    fn get_type(&self) -> ObjectType {
        self.get_obj().get_type()
    }
}

impl RailjsonObject {
    pub fn get_obj(&self) -> &dyn OSRDObject {
        match self {
            RailjsonObject::TrackSection { railjson: obj } => obj,
            RailjsonObject::Signal { railjson: obj } => obj,
            RailjsonObject::SpeedSection { railjson: obj } => obj,
            RailjsonObject::TrackSectionLink { railjson: obj } => obj,
            RailjsonObject::Switch { railjson: obj } => obj,
            RailjsonObject::SwitchType { railjson: obj } => obj,
            RailjsonObject::Detector { railjson: obj } => obj,
            RailjsonObject::BufferStop { railjson: obj } => obj,
            RailjsonObject::Route { railjson: obj } => obj,
            RailjsonObject::OperationalPoint { railjson: obj } => obj,
            RailjsonObject::Catenary { railjson: obj } => obj,
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            RailjsonObject::TrackSection { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Signal { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::SpeedSection { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::TrackSectionLink { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Switch { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::SwitchType { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Detector { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::BufferStop { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Route { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::OperationalPoint { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Catenary { railjson: obj } => serde_json::to_value(obj),
        }
        .unwrap()
    }
}

#[cfg(test)]
pub mod tests {
    use diesel::PgConnection;

    use crate::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::{apply_create_operation, RailjsonObject};
    use crate::schema::{
        BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
        SwitchType, TrackSection, TrackSectionLink,
    };

    pub fn create_track(
        conn: &mut PgConnection,
        infra_id: i64,
        track: TrackSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSection { railjson: track };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_signal(conn: &mut PgConnection, infra_id: i64, signal: Signal) -> RailjsonObject {
        let obj = RailjsonObject::Signal { railjson: signal };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_speed(
        conn: &mut PgConnection,
        infra_id: i64,
        speed: SpeedSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SpeedSection { railjson: speed };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_link(
        conn: &mut PgConnection,
        infra_id: i64,
        link: TrackSectionLink,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSectionLink { railjson: link };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_switch(conn: &mut PgConnection, infra_id: i64, switch: Switch) -> RailjsonObject {
        let obj = RailjsonObject::Switch { railjson: switch };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_detector(
        conn: &mut PgConnection,
        infra_id: i64,
        detector: Detector,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Detector { railjson: detector };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_buffer_stop(
        conn: &mut PgConnection,
        infra_id: i64,
        buffer_stop: BufferStop,
    ) -> RailjsonObject {
        let obj = RailjsonObject::BufferStop {
            railjson: buffer_stop,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_route(conn: &mut PgConnection, infra_id: i64, route: Route) -> RailjsonObject {
        let obj = RailjsonObject::Route { railjson: route };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_op(
        conn: &mut PgConnection,
        infra_id: i64,
        op: OperationalPoint,
    ) -> RailjsonObject {
        let obj = RailjsonObject::OperationalPoint { railjson: op };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_switch_type(
        conn: &mut PgConnection,
        infra_id: i64,
        st: SwitchType,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SwitchType { railjson: st };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    pub fn create_catenary(
        conn: &mut PgConnection,
        infra_id: i64,
        catenary: Catenary,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Catenary { railjson: catenary };
        assert!(apply_create_operation(&obj, infra_id, conn).is_ok());
        obj
    }

    #[test]
    fn create_track_test() {
        test_infra_transaction(|conn, infra| {
            create_track(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_signal_test() {
        test_infra_transaction(|conn, infra| {
            create_signal(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_speed_test() {
        test_infra_transaction(|conn, infra| {
            create_speed(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_link_test() {
        test_infra_transaction(|conn, infra| {
            create_link(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_switch_test() {
        test_infra_transaction(|conn, infra| {
            create_switch(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_detector_test() {
        test_infra_transaction(|conn, infra| {
            create_detector(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_buffer_stop_test() {
        test_infra_transaction(|conn, infra| {
            create_buffer_stop(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_route_test() {
        test_infra_transaction(|conn, infra| {
            create_route(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_op_test() {
        test_infra_transaction(|conn, infra| {
            create_op(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_switch_type_test() {
        test_infra_transaction(|conn, infra| {
            create_switch_type(conn, infra.id, Default::default());
        });
    }

    #[test]
    fn create_catenary_test() {
        test_infra_transaction(|conn, infra| {
            create_catenary(conn, infra.id, Default::default());
        });
    }
}
