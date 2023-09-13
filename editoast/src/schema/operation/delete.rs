use super::OperationError;
use crate::error::Result;
use crate::schema::ObjectRef;
use crate::schema::ObjectType;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Deserialize, Serialize, ToSchema)]
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
            self.obj_type.get_table()
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
    use crate::models::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::tests::{
        create_buffer_stop, create_catenary, create_detector, create_link, create_op, create_route,
        create_signal, create_speed, create_switch, create_track,
    };
    use crate::schema::operation::delete::DeleteOperation;
    use crate::schema::{OSRDIdentified, OSRDObject};
    use actix_web::test as actix_test;
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::RunQueryDsl;

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[actix_test]
    async fn delete_track() {
        test_infra_transaction(|conn, infra| async  move {
            let track = create_track(conn, infra.id.unwrap(), Default::default()).await;

            let track_deletion: DeleteOperation = track.get_ref().into();

            assert!(track_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_track_section WHERE obj_id = '{}' AND infra_id = {}",
                track.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_signal() {
        test_infra_transaction(|conn, infra| async  move {
            let signal = create_signal(conn, infra.id.unwrap(), Default::default()).await;

            let signal_deletion: DeleteOperation = signal.get_ref().into();

            assert!(signal_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_signal WHERE obj_id = '{}' AND infra_id = {}",
                signal.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_speed() {
        test_infra_transaction(|conn, infra| async  move {
            let speed = create_speed(conn, infra.id.unwrap(), Default::default()).await;

            let speed_deletion: DeleteOperation = speed.get_ref().into();

            assert!(speed_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_speed_section WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_link() {
        test_infra_transaction(|conn, infra| async  move {
            let link = create_link(conn, infra.id.unwrap(), Default::default()).await;

            let link_deletion: DeleteOperation = link.get_ref().into();

            assert!(link_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_track_section_link WHERE obj_id = '{}' AND infra_id = {}",
                link.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_switch() {
        test_infra_transaction(|conn, infra| async  move {
            let switch = create_switch(conn, infra.id.unwrap(), Default::default()).await;

            let switch_deletion: DeleteOperation = switch.get_ref().into();

            assert!(switch_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_switch WHERE obj_id = '{}' AND infra_id = {}",
                switch.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_detector() {
        test_infra_transaction(|conn, infra|async   move {
            let detector = create_detector(conn, infra.id.unwrap(), Default::default()).await;

            let detector_deletion: DeleteOperation = detector.get_ref().into();

            assert!(detector_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_detector WHERE obj_id = '{}' AND infra_id = {}",
                detector.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_buffer_stop() {
        test_infra_transaction(|conn, infra| async move {
            let buffer_stop = create_buffer_stop(conn, infra.id.unwrap(), Default::default()).await;

            let buffer_stop_deletion: DeleteOperation = buffer_stop.get_ref().into();

            assert!(buffer_stop_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_buffer_stop WHERE obj_id = '{}' AND infra_id = {}",
                buffer_stop.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_route() {
        test_infra_transaction(|conn, infra| async  move {
            let route = create_route(conn, infra.id.unwrap(), Default::default()).await;

            let route_deletion: DeleteOperation = route.get_ref().into();

            assert!(route_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_route WHERE obj_id = '{}' AND infra_id = {}",
                route.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_op() {
        test_infra_transaction(|conn, infra| async move {
            let op = create_op(conn, infra.id.unwrap(), Default::default()).await;

            let op_deletion: DeleteOperation = op.get_ref().into();

            assert!(op_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_operational_point WHERE obj_id = '{}' AND infra_id = {}",
                op.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn delete_catenary() {
        test_infra_transaction(|conn, infra| async  move {
            let catenary = create_catenary(conn, infra.id.unwrap(), Default::default()).await;

            let op_deletion: DeleteOperation = catenary.get_ref().into();

            assert!(op_deletion.apply(infra.id.unwrap(), conn).await.is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_catenary WHERE obj_id = '{}' AND infra_id = {}",
                catenary.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Count>(conn).await.unwrap();

            assert_eq!(res_del.nb, 0);
        }.scope_boxed()).await;
    }
}
