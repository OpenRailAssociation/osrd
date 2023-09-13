use crate::error::Result;
use crate::schema::{
    BufferStop, Catenary, Detector, NeutralSection, OSRDIdentified, OSRDObject, ObjectType,
    OperationalPoint, Route, Signal, SpeedSection, Switch, SwitchType, TrackSection,
    TrackSectionLink,
};
use diesel::sql_query;
use diesel::sql_types::{BigInt, Json, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use super::OperationError;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum RailjsonObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    NeutralSection { railjson: NeutralSection },
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

pub async fn apply_create_operation(
    railjson_object: &RailjsonObject,
    infra_id: i64,
    conn: &mut PgConnection,
) -> Result<usize> {
    if railjson_object.get_id().is_empty() {
        return Err(OperationError::EmptyId.into());
    }
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        railjson_object.get_type().get_table()
    ))
    .bind::<BigInt, _>(infra_id)
    .bind::<Text, _>(railjson_object.get_id())
    .bind::<Json, _>(railjson_object.get_data())
    .execute(conn)
    .await
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
            RailjsonObject::NeutralSection { railjson: obj } => serde_json::to_value(obj),
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

impl From<TrackSection> for RailjsonObject {
    fn from(track: TrackSection) -> Self {
        RailjsonObject::TrackSection { railjson: track }
    }
}

impl From<Catenary> for RailjsonObject {
    fn from(catenary: Catenary) -> Self {
        RailjsonObject::Catenary { railjson: catenary }
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

impl From<TrackSectionLink> for RailjsonObject {
    fn from(tracksectionlink: TrackSectionLink) -> Self {
        RailjsonObject::TrackSectionLink {
            railjson: tracksectionlink,
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

    use crate::models::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::{apply_create_operation, RailjsonObject};
    use crate::schema::{
        BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
        SwitchType, TrackSection, TrackSectionLink,
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

    pub async fn create_link(
        conn: &mut PgConnection,
        infra_id: i64,
        link: TrackSectionLink,
    ) -> RailjsonObject {
        let obj = RailjsonObject::TrackSectionLink { railjson: link };
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

    pub async fn create_catenary(
        conn: &mut PgConnection,
        infra_id: i64,
        catenary: Catenary,
    ) -> RailjsonObject {
        let obj = RailjsonObject::Catenary { railjson: catenary };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    #[actix_test]
    async fn create_track_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_track(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_signal_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_signal(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_speed_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_speed(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_link_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_link(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_switch_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_switch(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_detector_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_detector(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_buffer_stop_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_buffer_stop(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_route_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_route(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_op_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_op(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_switch_type_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_switch_type(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_catenary_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                create_catenary(conn, infra.id.unwrap(), Default::default()).await;
            }
            .scope_boxed()
        })
        .await;
    }
}
