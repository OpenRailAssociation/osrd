use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use crate::modelsv2::DbConnection;
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
    pub async fn apply(&self, infra_id: i64, conn: &mut DbConnection) -> Result<()> {
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
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::RunQueryDsl;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use std::ops::DerefMut;

    use crate::infra_cache::operation::delete::DeleteOperation;
    use crate::modelsv2::fixtures::create_buffer_stop;
    use crate::modelsv2::fixtures::create_detector;
    use crate::modelsv2::fixtures::create_electrification;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_op;
    use crate::modelsv2::fixtures::create_route;
    use crate::modelsv2::fixtures::create_signal;
    use crate::modelsv2::fixtures::create_speed;
    use crate::modelsv2::fixtures::create_switch;
    use crate::modelsv2::fixtures::create_track;
    use crate::modelsv2::DbConnectionPoolV2;
    use editoast_schemas::primitives::OSRDIdentified;
    use editoast_schemas::primitives::OSRDObject;

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[rstest]
    async fn delete_track() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let track = create_track(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;

        let track_deletion: DeleteOperation = track.get_ref().into();

        assert!(track_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_track_section WHERE obj_id = '{}' AND infra_id = {}",
                track.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_signal() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let signal =
            create_signal(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;

        let signal_deletion: DeleteOperation = signal.get_ref().into();

        assert!(signal_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
            "SELECT COUNT (*) AS nb FROM infra_object_signal WHERE obj_id = '{}' AND infra_id = {}",
            signal.get_id(),
            infra.id
        ))
        .get_result::<Count>(db_pool.get_ok().deref_mut())
        .await
        .unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_speed() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let speed = create_speed(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
        let speed_deletion: DeleteOperation = speed.get_ref().into();

        assert!(speed_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_speed_section WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_switch() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let switch =
            create_switch(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
        let switch_deletion: DeleteOperation = switch.get_ref().into();

        assert!(switch_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
            "SELECT COUNT (*) AS nb FROM infra_object_switch WHERE obj_id = '{}' AND infra_id = {}",
            switch.get_id(),
            infra.id
        ))
        .get_result::<Count>(db_pool.get_ok().deref_mut())
        .await
        .unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_detector() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let detector =
            create_detector(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
        let detector_deletion: DeleteOperation = detector.get_ref().into();

        assert!(detector_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_detector WHERE obj_id = '{}' AND infra_id = {}",
                detector.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_buffer_stop() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let buffer_stop =
            create_buffer_stop(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
        let buffer_stop_deletion: DeleteOperation = buffer_stop.get_ref().into();

        assert!(buffer_stop_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_buffer_stop WHERE obj_id = '{}' AND infra_id = {}",
                buffer_stop.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_route() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let route = create_route(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;
        let route_deletion: DeleteOperation = route.get_ref().into();

        assert!(route_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
            "SELECT COUNT (*) AS nb FROM infra_object_route WHERE obj_id = '{}' AND infra_id = {}",
            route.get_id(),
            infra.id
        ))
        .get_result::<Count>(db_pool.get_ok().deref_mut())
        .await
        .unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_op() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let op = create_op(db_pool.get_ok().deref_mut(), infra.id, Default::default()).await;

        let op_deletion: DeleteOperation = op.get_ref().into();

        assert!(op_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());
        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_operational_point WHERE obj_id = '{}' AND infra_id = {}",
                op.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }

    #[rstest]
    async fn delete_electrification() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let electrification =
            create_electrification(db_pool.get_ok().deref_mut(), infra.id, Default::default())
                .await;
        let op_deletion: DeleteOperation = electrification.get_ref().into();

        assert!(op_deletion
            .apply(infra.id, db_pool.get_ok().deref_mut())
            .await
            .is_ok());

        let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM infra_object_electrification WHERE obj_id = '{}' AND infra_id = {}",
                electrification.get_id(),
                infra.id
            ))
            .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

        assert_eq!(res_del.nb, 0);
    }
}
