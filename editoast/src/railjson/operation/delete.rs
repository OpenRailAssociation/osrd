use super::OperationError;
use crate::error::ApiError;
use crate::railjson::ObjectRef;
use diesel::sql_types::{Integer, Text};
use diesel::RunQueryDsl;
use diesel::{sql_query, PgConnection};

pub fn apply_delete_operation(
    object_ref: &ObjectRef,
    infra_id: i32,
    conn: &PgConnection,
) -> Result<(), Box<dyn ApiError>> {
    match sql_query(format!(
        "DELETE FROM {} WHERE obj_id = $1 AND infra_id = $2",
        object_ref.obj_type.get_table()
    ))
    .bind::<Text, _>(&object_ref.obj_id)
    .bind::<Integer, _>(&infra_id)
    .execute(conn)
    {
        Ok(1) => Ok(()),
        Ok(_) => Err(Box::new(OperationError::ObjectNotFound(
            object_ref.obj_id.clone(),
        ))),
        Err(err) => Err(err.into()),
    }
}

#[cfg(test)]
mod test {
    use crate::models::infra::test::test_transaction;
    use crate::railjson::operation::create::test::{create_signal, create_speed, create_track};
    use crate::railjson::operation::delete::apply_delete_operation;
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

            let track_ref = track.get_ref();

            assert!(apply_delete_operation(&track_ref, infra.id, conn).is_ok());

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

            let signal_ref = signal.get_ref();

            assert!(apply_delete_operation(&signal_ref, infra.id, conn).is_ok());

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

            let speed_ref = speed.get_ref();

            assert!(apply_delete_operation(&speed_ref, infra.id, conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_speedsectionmodel WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_obj_id(),
                infra.id
            ))
            .get_result::<Count>(conn).unwrap();

            assert_eq!(res_del.nb, 0);
        });
    }
}
