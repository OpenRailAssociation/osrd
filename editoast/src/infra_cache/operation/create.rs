use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use crate::modelsv2::DbConnection;
use editoast_schemas::infra::InfraObject;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;

pub async fn apply_create_operation<'r>(
    railjson_object: &'r InfraObject,
    infra_id: i64,
    conn: &mut DbConnection,
) -> Result<(usize, &'r InfraObject)> {
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

#[cfg(test)]
pub mod tests {
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::modelsv2::infra::tests::test_infra_transaction;
    use crate::modelsv2::DbConnection;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::InfraObject;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::TrackSection;

    pub async fn create_track(
        conn: &mut DbConnection,
        infra_id: i64,
        track: TrackSection,
    ) -> InfraObject {
        let obj = InfraObject::TrackSection { railjson: track };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_signal(
        conn: &mut DbConnection,
        infra_id: i64,
        signal: Signal,
    ) -> InfraObject {
        let obj = InfraObject::Signal { railjson: signal };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_speed(
        conn: &mut DbConnection,
        infra_id: i64,
        speed: SpeedSection,
    ) -> InfraObject {
        let obj = InfraObject::SpeedSection { railjson: speed };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch(
        conn: &mut DbConnection,
        infra_id: i64,
        switch: Switch,
    ) -> InfraObject {
        let obj = InfraObject::Switch { railjson: switch };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_detector(
        conn: &mut DbConnection,
        infra_id: i64,
        detector: Detector,
    ) -> InfraObject {
        let obj = InfraObject::Detector { railjson: detector };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_buffer_stop(
        conn: &mut DbConnection,
        infra_id: i64,
        buffer_stop: BufferStop,
    ) -> InfraObject {
        let obj = InfraObject::BufferStop {
            railjson: buffer_stop,
        };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_route(conn: &mut DbConnection, infra_id: i64, route: Route) -> InfraObject {
        let obj = InfraObject::Route { railjson: route };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_op(
        conn: &mut DbConnection,
        infra_id: i64,
        op: OperationalPoint,
    ) -> InfraObject {
        let obj = InfraObject::OperationalPoint { railjson: op };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_switch_type(
        conn: &mut DbConnection,
        infra_id: i64,
        st: SwitchType,
    ) -> InfraObject {
        let obj = InfraObject::SwitchType { railjson: st };
        assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
        obj
    }

    pub async fn create_electrification(
        conn: &mut DbConnection,
        infra_id: i64,
        electrification: Electrification,
    ) -> InfraObject {
        let obj = InfraObject::Electrification {
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
