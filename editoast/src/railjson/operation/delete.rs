use super::OperationError;
use crate::error::ApiError;
use crate::railjson::ObjectRef;
use crate::railjson::ObjectType;
use diesel::sql_types::{Integer, Text};
use diesel::RunQueryDsl;
use diesel::{sql_query, PgConnection};
use serde::Deserialize;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
/// A delete operation. Contains same information as a object ref but has another serialization.
pub struct DeleteOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
}

impl DeleteOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
        match sql_query(format!(
            "DELETE FROM {} WHERE obj_id = $1 AND infra_id = $2",
            self.obj_type.get_table()
        ))
        .bind::<Text, _>(self.obj_id.clone())
        .bind::<Integer, _>(&infra_id)
        .execute(conn)
        {
            Ok(1) => Ok(()),
            Ok(_) => Err(Box::new(OperationError::ObjectNotFound(
                self.obj_id.clone(),
            ))),
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
mod test {
    use crate::models::infra::test::test_transaction;
    use crate::railjson::operation::create::test::{
        create_buffer_stop, create_detector, create_link, create_route, create_signal,
        create_speed, create_switch, create_track,
    };
    use crate::railjson::operation::delete::DeleteOperation;
    use diesel::sql_types::BigInt;
    use diesel::{sql_query, RunQueryDsl};

    #[derive(QueryableByName)]
    struct Count {
        #[sql_type = "BigInt"]
        nb: i64,
    }

    #[test]
    fn delete_track() {
        test_transaction(|conn, infra| {
            let track = create_track(conn, infra.id, Default::default());

            let track_deletion: DeleteOperation = track.get_ref().into();

            assert!(track_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_tracksectionmodel WHERE obj_id = '{}' AND infra_id = {}",
                track.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_signal() {
        test_transaction(|conn, infra| {
            let signal = create_signal(conn, infra.id, Default::default());

            let signal_deletion: DeleteOperation = signal.get_ref().into();

            assert!(signal_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_signalmodel WHERE obj_id = '{}' AND infra_id = {}",
                signal.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_speed() {
        test_transaction(|conn, infra| {
            let speed = create_speed(conn, infra.id, Default::default());

            let speed_deletion: DeleteOperation = speed.get_ref().into();

            assert!(speed_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_speedsectionmodel WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_link() {
        test_transaction(|conn, infra| {
            let link = create_link(conn, infra.id, Default::default());

            let link_deletion: DeleteOperation = link.get_ref().into();

            assert!(link_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_tracksectionlinkmodel WHERE obj_id = '{}' AND infra_id = {}",
                link.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_switch() {
        test_transaction(|conn, infra| {
            let switch = create_switch(conn, infra.id, Default::default());

            let switch_deletion: DeleteOperation = switch.get_ref().into();

            assert!(switch_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_switchmodel WHERE obj_id = '{}' AND infra_id = {}",
                switch.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_detector() {
        test_transaction(|conn, infra| {
            let detector = create_detector(conn, infra.id, Default::default());

            let detector_deletion: DeleteOperation = detector.get_ref().into();

            assert!(detector_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_detectormodel WHERE obj_id = '{}' AND infra_id = {}",
                detector.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_buffer_stop() {
        test_transaction(|conn, infra| {
            let buffer_stop = create_buffer_stop(conn, infra.id, Default::default());

            let buffer_stop_deletion: DeleteOperation = buffer_stop.get_ref().into();

            assert!(buffer_stop_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_bufferstopmodel WHERE obj_id = '{}' AND infra_id = {}",
                buffer_stop.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }

    #[test]
    fn delete_route() {
        test_transaction(|conn, infra| {
            let route = create_route(conn, infra.id, Default::default());

            let route_deletion: DeleteOperation = route.get_ref().into();

            assert!(route_deletion.apply(infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_routemodel WHERE obj_id = '{}' AND infra_id = {}",
                route.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }
}
