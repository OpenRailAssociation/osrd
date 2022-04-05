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
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use crate::railjson::operation::create::apply_create_operation;
    use crate::railjson::operation::delete::apply_delete_operation;
    use crate::railjson::operation::RailjsonObject;
    use diesel::result::Error;
    use diesel::sql_types::BigInt;
    use diesel::{sql_query, Connection, PgConnection, RunQueryDsl};

    #[derive(QueryableByName)]
    struct Count {
        #[sql_type = "BigInt"]
        nb: i64,
    }

    #[test]
    fn delete_track() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let track_creation = RailjsonObject::TrackSection {
                railjson: Default::default()
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&track_creation, infra.id, &conn).is_ok());

            let track_deletion = track_creation.get_ref();

            assert!(apply_delete_operation(&track_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_tracksectionmodel WHERE obj_id = 'my_track' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Count>(&conn).unwrap();

            assert_eq!(res_del.nb, 0);

            Ok(())
        });
    }

    #[test]
    fn delete_signal() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let signal_creation = RailjsonObject::Signal {
                railjson: Default::default(),
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&signal_creation, infra.id, &conn).is_ok());

            let signal_deletion = signal_creation.get_ref();

            assert!(apply_delete_operation(&signal_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_signalmodel WHERE obj_id = 'my_signal' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Count>(&conn).unwrap();

            assert_eq!(res_del.nb, 0);

            Ok(())
        });
    }

    #[test]
    fn delete_speed() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let speed_creation = RailjsonObject::SpeedSection {
                railjson: Default::default()
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&speed_creation, infra.id, &conn).is_ok());

            let speed_deletion = speed_creation.get_ref();

            assert!(apply_delete_operation(&speed_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_speedsectionmodel WHERE obj_id = 'my_speed' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Count>(&conn).unwrap();

            assert_eq!(res_del.nb, 0);

            Ok(())
        });
    }
}
