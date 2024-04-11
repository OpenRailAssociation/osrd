use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::AsyncPgConnection as PgConnection;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
/// A delete operation. Contains same information as a object ref but has another serialization.
pub struct DeleteOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
}

impl DeleteOperation {
    pub async fn apply(&self, infra_id: i64, conn: &mut PgConnection) -> Result<()> {
        match sql_query(format!(
            "DELETE FROM {} WHERE obj_id = $1 AND infra_id = $2",
            get_table(&self.obj_type)
        ))
        .bind::<Text, _>(&self.obj_id)
        .bind::<BigInt, _>(&infra_id)
        .execute(conn)
        .await
        {
            Ok(1) => Ok(()),
            Ok(_) => Err(OperationError::ObjectNotFound {
                obj_id: self.obj_id.clone(),
                infra_id,
            }
            .into()),
            Err(err) => Err(err.into()),
        }
    }
}

impl From<DeleteOperation> for ObjectRef {
    fn from(del_op: DeleteOperation) -> Self {
        Self {
            obj_id: del_op.obj_id,
            obj_type: del_op.obj_type,
        }
    }
}

impl From<ObjectRef> for DeleteOperation {
    fn from(obj_ref: ObjectRef) -> Self {
        Self {
            obj_id: obj_ref.obj_id,
            obj_type: obj_ref.obj_type,
        }
    }
}

#[cfg(test)]
mod tests {
    use actix_web::test as actix_test;
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::RunQueryDsl;

    use crate::infra_cache::operation::create::tests::create_buffer_stop;
    use crate::infra_cache::operation::create::tests::create_detector;
    use crate::infra_cache::operation::create::tests::create_electrification;
    use crate::infra_cache::operation::create::tests::create_op;
    use crate::infra_cache::operation::create::tests::create_route;
    use crate::infra_cache::operation::create::tests::create_signal;
    use crate::infra_cache::operation::create::tests::create_speed;
    use crate::infra_cache::operation::create::tests::create_switch;
    use crate::infra_cache::operation::create::tests::create_track;
    use crate::infra_cache::operation::delete::DeleteOperation;
    use crate::modelsv2::infra::tests::test_infra_transaction;
    use editoast_schemas::primitives::OSRDIdentified;
    use editoast_schemas::primitives::OSRDObject;

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[actix_test]
    async fn delete_track() {
        test_infra_transaction(|conn, infra| async  move {
            let track = create_track(conn, infra.id, Default::default()).await;

            let track_deletion: DeleteOperation = track.get_ref().into();

            assert!(track_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_track_section WHERE obj_id = '{}' AND infra_id = {}",
                track.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_signal() {
        test_infra_transaction(|conn, infra| async  move {
            let signal = create_signal(conn, infra.id, Default::default()).await;

            let signal_deletion: DeleteOperation = signal.get_ref().into();

            assert!(signal_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_signal WHERE obj_id = '{}' AND infra_id = {}",
                signal.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_speed() {
        test_infra_transaction(|conn, infra| async  move {
            let speed = create_speed(conn, infra.id, Default::default()).await;

            let speed_deletion: DeleteOperation = speed.get_ref().into();

            assert!(speed_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_speed_section WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_switch() {
        test_infra_transaction(|conn, infra| async  move {
            let switch = create_switch(conn, infra.id, Default::default()).await;

            let switch_deletion: DeleteOperation = switch.get_ref().into();

            assert!(switch_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_switch WHERE obj_id = '{}' AND infra_id = {}",
                switch.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_detector() {
        test_infra_transaction(|conn, infra|async   move {
            let detector = create_detector(conn, infra.id, Default::default()).await;

            let detector_deletion: DeleteOperation = detector.get_ref().into();

            assert!(detector_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_detector WHERE obj_id = '{}' AND infra_id = {}",
                detector.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_buffer_stop() {
        test_infra_transaction(|conn, infra| async move {
            let buffer_stop = create_buffer_stop(conn, infra.id, Default::default()).await;

            let buffer_stop_deletion: DeleteOperation = buffer_stop.get_ref().into();

            assert!(buffer_stop_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_buffer_stop WHERE obj_id = '{}' AND infra_id = {}",
                buffer_stop.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_route() {
        test_infra_transaction(|conn, infra| async  move {
            let route = create_route(conn, infra.id, Default::default()).await;

            let route_deletion: DeleteOperation = route.get_ref().into();

            assert!(route_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_route WHERE obj_id = '{}' AND infra_id = {}",
                route.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_op() {
        test_infra_transaction(|conn, infra| async move {
            let op = create_op(conn, infra.id, Default::default()).await;

            let op_deletion: DeleteOperation = op.get_ref().into();

            assert!(op_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_operational_point WHERE obj_id = '{}' AND infra_id = {}",
                op.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_electrification() {
        test_infra_transaction(|conn, infra| async  move {
            let electrification = create_electrification(conn, infra.id, Default::default()).await;

            let op_deletion: DeleteOperation = electrification.get_ref().into();

            assert!(op_deletion.apply(infra.id, conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_electrification WHERE obj_id = '{}' AND infra_id = {}",
                electrification.get_id(),
                infra.id
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }
}
