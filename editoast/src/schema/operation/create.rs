use crate::error::Result;
use crate::modelsv2::get_table;
use crate::schema::{
    BufferStop, Detector, Electrification, NeutralSection, OSRDIdentified, OSRDObject, ObjectType,
    OperationalPoint, Route, Signal, SpeedSection, Switch, SwitchType, TrackSection,
};
use diesel::sql_query;
use diesel::sql_types::{BigInt, Json, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use json_patch::Patch;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::OperationError;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum RailjsonObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    NeutralSection { railjson: NeutralSection },
    SpeedSection { railjson: SpeedSection },
    Switch { railjson: Switch },
    SwitchType { railjson: SwitchType },
    Detector { railjson: Detector },
    BufferStop { railjson: BufferStop },
    Route { railjson: Route },
    OperationalPoint { railjson: OperationalPoint },
    Electrification { railjson: Electrification },
}

pub async fn apply_create_operation<'r>(
    railjson_object: &'r RailjsonObject,
    infra_id: i64,
    conn: &mut PgConnection,
) -> Result<(usize, &'r RailjsonObject)> {
    if railjson_object.get_id().is_empty() {
        return Err(OperationError::EmptyId.into());
    }
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        get_table(&railjson_object.get_type())
    ))
    .bind::<BigInt, _>(infra_id)
    .bind::<Text, _>(railjson_object.get_id())
    .bind::<Json, _>(railjson_object.get_data())
    .execute(conn)
    .await
    .map(|idx| (idx, railjson_object))
    .map_err(|err| err.into())
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
            RailjsonObject::NeutralSection { railjson: obj } => obj,
            RailjsonObject::SpeedSection { railjson: obj } => obj,
            RailjsonObject::Switch { railjson: obj } => obj,
            RailjsonObject::SwitchType { railjson: obj } => obj,
            RailjsonObject::Detector { railjson: obj } => obj,
            RailjsonObject::BufferStop { railjson: obj } => obj,
            RailjsonObject::Route { railjson: obj } => obj,
            RailjsonObject::OperationalPoint { railjson: obj } => obj,
            RailjsonObject::Electrification { railjson: obj } => obj,
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            RailjsonObject::TrackSection { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Signal { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::SpeedSection { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::NeutralSection { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Switch { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::SwitchType { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Detector { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::BufferStop { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Route { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::OperationalPoint { railjson: obj } => serde_json::to_value(obj),
            RailjsonObject::Electrification { railjson: obj } => serde_json::to_value(obj),
        }
        .unwrap()
    }

    pub fn patch(self, json_patch: &Patch) -> Result<Self> {
        // `json_patch::patch()` operates on `serde_json::Value`.
        // Therefore, we have to:
        // (1) transform `RailjsonObject` into `serde_json::Value`,
        // (2) patch the object,
        // (3) transform `serde_json::Value` back into a `RailjsonObject`.
        // The code below is explicitely typed (even if not needed) to help understand this dance.
        let object_type = self.get_type();
        let mut value: serde_json::Value = match &self {
            RailjsonObject::TrackSection { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::Signal { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::NeutralSection { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::SpeedSection { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::Switch { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::SwitchType { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::Detector { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::BufferStop { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::Route { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::OperationalPoint { railjson } => serde_json::to_value(railjson)?,
            RailjsonObject::Electrification { railjson } => serde_json::to_value(railjson)?,
        };
        json_patch::patch(&mut value, json_patch)?;
        let railjson_object = match object_type {
            ObjectType::TrackSection => RailjsonObject::TrackSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Signal => RailjsonObject::Signal {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::SpeedSection => RailjsonObject::SpeedSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Detector => RailjsonObject::Detector {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::NeutralSection => RailjsonObject::NeutralSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Switch => RailjsonObject::Switch {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::SwitchType => RailjsonObject::SwitchType {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::BufferStop => RailjsonObject::BufferStop {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Route => RailjsonObject::Route {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::OperationalPoint => RailjsonObject::OperationalPoint {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Electrification => RailjsonObject::Electrification {
                railjson: serde_json::from_value(value)?,
            },
        };
        Ok(railjson_object)
    }
}

impl From<TrackSection> for RailjsonObject {
    fn from(track: TrackSection) -> Self {
        RailjsonObject::TrackSection { railjson: track }
    }
}

impl From<Electrification> for RailjsonObject {
    fn from(electrification: Electrification) -> Self {
        RailjsonObject::Electrification {
            railjson: electrification,
        }
    }
}

impl From<Signal> for RailjsonObject {
    fn from(signal: Signal) -> Self {
        RailjsonObject::Signal { railjson: signal }
    }
}

impl From<SpeedSection> for RailjsonObject {
    fn from(speedsection: SpeedSection) -> Self {
        RailjsonObject::SpeedSection {
            railjson: speedsection,
        }
    }
}

impl From<Switch> for RailjsonObject {
    fn from(switch: Switch) -> Self {
        RailjsonObject::Switch { railjson: switch }
    }
}

impl From<SwitchType> for RailjsonObject {
    fn from(switchtype: SwitchType) -> Self {
        RailjsonObject::SwitchType {
            railjson: switchtype,
        }
    }
}

impl From<Detector> for RailjsonObject {
    fn from(detector: Detector) -> Self {
        RailjsonObject::Detector { railjson: detector }
    }
}

impl From<BufferStop> for RailjsonObject {
    fn from(bufferstop: BufferStop) -> Self {
        RailjsonObject::BufferStop {
            railjson: bufferstop,
        }
    }
}

impl From<Route> for RailjsonObject {
    fn from(route: Route) -> Self {
        RailjsonObject::Route { railjson: route }
    }
}

impl From<OperationalPoint> for RailjsonObject {
    fn from(operationalpoint: OperationalPoint) -> Self {
        RailjsonObject::OperationalPoint {
            railjson: operationalpoint,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncPgConnection as PgConnection;

    use crate::modelsv2::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::{apply_create_operation, RailjsonObject};
    use crate::schema::{
        BufferStop, Detector, Electrification, OperationalPoint, Route, Signal, SpeedSection,
        Switch, SwitchType, TrackSection,
    };

    pub async fn create_track(
        conn: &mut PgConnection,
        infra_id: i64,
        track: TrackSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSection { railjson: track };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_signal(
        conn: &mut PgConnection,
        infra_id: i64,
        signal: Signal,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Signal { railjson: signal };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_speed(
        conn: &mut PgConnection,
        infra_id: i64,
        speed: SpeedSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SpeedSection { railjson: speed };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch(
        conn: &mut PgConnection,
        infra_id: i64,
        switch: Switch,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Switch { railjson: switch };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_detector(
        conn: &mut PgConnection,
        infra_id: i64,
        detector: Detector,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Detector { railjson: detector };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_buffer_stop(
        conn: &mut PgConnection,
        infra_id: i64,
        buffer_stop: BufferStop,
    ) -> RailjsonObject {
        let obj = RailjsonObject::BufferStop {
            railjson: buffer_stop,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_route(
        conn: &mut PgConnection,
        infra_id: i64,
        route: Route,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Route { railjson: route };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_op(
        conn: &mut PgConnection,
        infra_id: i64,
        op: OperationalPoint,
    ) -> RailjsonObject {
        let obj = RailjsonObject::OperationalPoint { railjson: op };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch_type(
        conn: &mut PgConnection,
        infra_id: i64,
        st: SwitchType,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SwitchType { railjson: st };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_electrification(
        conn: &mut PgConnection,
        infra_id: i64,
        electrification: Electrification,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Electrification {
            railjson: electrification,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    #[actix_test]
    async fn create_track_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_track(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_signal_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_signal(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_speed_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_speed(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_switch_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_switch(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_detector_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_detector(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_buffer_stop_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_buffer_stop(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_route_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_route(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_op_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_op(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_switch_type_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_switch_type(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_electrification_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_electrification(conn, infra.id, Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }
}
