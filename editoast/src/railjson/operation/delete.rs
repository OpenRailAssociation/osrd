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
    use crate::railjson::{ObjectRef, ObjectType, Signal, SpeedSection, TrackSection};
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
                railjson: TrackSection {
                    id: "my_track".to_string(),
                    length: 100.,
                    line_name: "line_test".to_string(),
                    track_name: "track_test".to_string(),
                    ..Default::default()
                },
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&track_creation, infra.id, &conn).is_ok());

            let track_deletion = ObjectRef {
                obj_type: ObjectType::TrackSection,
                obj_id: "my_track".to_string(),
            };

            assert!(apply_delete_operation(&track_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_tracksectionmodel WHERE obj_id = 'my_track' AND infra_id = {}",
                infra.id
            ))
            .load::<Count>(&conn).unwrap();

            assert_eq!(res_del[0].nb, 0);

            Ok(())
        });
    }

    #[test]
    fn delete_signal() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let signal_creation = RailjsonObject::Signal {
                railjson: Signal {
                    id: "my_signal".to_string(),
                    sight_distance: 10.0,
                    ..Default::default()
                },
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&signal_creation, infra.id, &conn).is_ok());

            let signal_deletion = ObjectRef {
                obj_type: ObjectType::Signal,
                obj_id: "my_signal".to_string(),
            };

            assert!(apply_delete_operation(&signal_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_signalmodel WHERE obj_id = 'my_signal' AND infra_id = {}",
                infra.id
            ))
            .load::<Count>(&conn).unwrap();

            assert_eq!(res_del[0].nb, 0);

            Ok(())
        });
    }

    #[test]
    fn delete_speed() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let speed_creation = RailjsonObject::SpeedSection {
                railjson: SpeedSection {
                    id: "my_speed".to_string(),
                    speed: 100.0,
                    ..Default::default()
                },
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&speed_creation, infra.id, &conn).is_ok());

            let speed_deletion = ObjectRef {
                obj_type: ObjectType::SpeedSection,
                obj_id: "my_speed".to_string(),
            };

            assert!(apply_delete_operation(&speed_deletion, infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_speedsectionmodel WHERE obj_id = 'my_speed' AND infra_id = {}",
                infra.id
            ))
            .load::<Count>(&conn).unwrap();

            assert_eq!(res_del[0].nb, 0);

            Ok(())
        });
    }
}
