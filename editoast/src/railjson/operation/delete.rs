use super::{ObjectType, OperationError};
use crate::response::ApiError;
use diesel::sql_types::{Integer, Text};
use diesel::RunQueryDsl;
use diesel::{sql_query, PgConnection};
use rocket::serde::Deserialize;

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct DeleteOperation {
    pub obj_type: ObjectType,
    pub obj_id: String,
}

impl DeleteOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
        match sql_query(format!(
            "DELETE FROM {} WHERE obj_id = $1 AND infra_id = $2",
            self.obj_type.get_table()
        ))
        .bind::<Text, _>(&self.obj_id)
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

#[cfg(test)]
mod test {
    use super::DeleteOperation;
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use crate::railjson::operation::CreateOperation;
    use crate::railjson::ObjectType;
    use crate::railjson::TrackSection;
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
            let track_creation = CreateOperation::TrackSection {
                railjson: TrackSection {
                    id: "my_track".to_string(),
                    length: 100.,
                    line_name: "line_test".to_string(),
                    track_name: "track_test".to_string(),
                    ..Default::default()
                },
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(track_creation.apply(infra.id, &conn).is_ok());

            let track_deletion = DeleteOperation {
                obj_type: ObjectType::TrackSection,
                obj_id: "my_track".to_string(),
            };

            assert!(track_deletion.apply(infra.id, &conn).is_ok());

            let res_del = sql_query(format!(
                "SELECT COUNT (*) AS nb FROM osrd_infra_tracksectionmodel WHERE obj_id = 'my_track' AND infra_id = {}",
                infra.id
            ))
            .load::<Count>(&conn).unwrap();

            assert_eq!(res_del[0].nb, 0);

            Ok(())
        });
    }
}
