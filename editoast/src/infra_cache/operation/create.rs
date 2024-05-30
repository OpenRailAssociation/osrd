use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use json_patch::Patch;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use crate::modelsv2::DbConnection;
use editoast_schemas::infra::BufferStop;
use editoast_schemas::infra::Detector;
use editoast_schemas::infra::Electrification;
use editoast_schemas::infra::NeutralSection;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::infra::Route;
use editoast_schemas::infra::Signal;
use editoast_schemas::infra::SpeedSection;
use editoast_schemas::infra::Switch;
use editoast_schemas::infra::SwitchType;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::primitives::ObjectType;

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
    conn: &mut DbConnection,
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

impl From<NeutralSection> for RailjsonObject {
    fn from(neutralsection: NeutralSection) -> Self {
        RailjsonObject::NeutralSection {
            railjson: neutralsection,
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
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::infra_cache::operation::create::RailjsonObject;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::DbConnection;
    use crate::modelsv2::DbConnectionPoolV2;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::TrackSection;
    use rstest::rstest;
    use std::ops::DerefMut;

    pub async fn create_track(
        conn: &mut DbConnection,
        infra_id: i64,
        track: TrackSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSection { railjson: track };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_signal(
        conn: &mut DbConnection,
        infra_id: i64,
        signal: Signal,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Signal { railjson: signal };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_speed(
        conn: &mut DbConnection,
        infra_id: i64,
        speed: SpeedSection,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SpeedSection { railjson: speed };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch(
        conn: &mut DbConnection,
        infra_id: i64,
        switch: Switch,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Switch { railjson: switch };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_detector(
        conn: &mut DbConnection,
        infra_id: i64,
        detector: Detector,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Detector { railjson: detector };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_buffer_stop(
        conn: &mut DbConnection,
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
        conn: &mut DbConnection,
        infra_id: i64,
        route: Route,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Route { railjson: route };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_op(
        conn: &mut DbConnection,
        infra_id: i64,
        op: OperationalPoint,
    ) -> RailjsonObject {
        let obj = RailjsonObject::OperationalPoint { railjson: op };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch_type(
        conn: &mut DbConnection,
        infra_id: i64,
        st: SwitchType,
    ) -> RailjsonObject {
        let obj = RailjsonObject::SwitchType { railjson: st };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_electrification(
        conn: &mut DbConnection,
        infra_id: i64,
        electrification: Electrification,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Electrification {
            railjson: electrification,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    #[rstest]
    async fn create_track_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_track(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_signal_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_signal(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_speed_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_speed(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_switch_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_switch(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_detector_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_detector(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_buffer_stop_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_buffer_stop(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_route_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_route(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_op_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_op(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_switch_type_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_switch_type(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }

    #[rstest]
    async fn create_electrification_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        create_electrification(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
    }
}
