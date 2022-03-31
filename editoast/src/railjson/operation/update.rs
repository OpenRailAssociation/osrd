use super::{ObjectType, OperationError};
use crate::railjson::operation::RailjsonObject;
use crate::railjson::TrackSection;
use crate::response::ApiError;
use diesel::sql_types::Jsonb;
use diesel::sql_types::{Integer, Json, Text};
use diesel::{sql_query, PgConnection, QueryableByName, RunQueryDsl};
use json_patch::Patch;
use serde::Deserialize;
use serde_json::{from_value, Value};

#[derive(Clone, Deserialize)]
pub struct UpdateOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
    railjson_patch: Patch,
}

impl UpdateOperation {
    pub fn apply(
        &self,
        infra_id: i32,
        conn: &PgConnection,
    ) -> Result<RailjsonObject, Box<dyn ApiError>> {
        // Load object
        let mut obj: DataObject = sql_query(format!(
            "SELECT data FROM {} WHERE infra_id = {} AND obj_id = '{}'",
            self.obj_type.get_table(),
            infra_id,
            self.obj_id
        ))
        .get_result(conn)?;

        // Apply and check patch
        let railjson_obj = obj.patch_and_check(self)?;

        // Save new object
        match sql_query(format!(
            "UPDATE {} SET data = $1 WHERE infra_id = $2 AND obj_id = $3",
            self.obj_type.get_table()
        ))
        .bind::<Json, _>(obj.data)
        .bind::<Integer, _>(infra_id)
        .bind::<Text, _>(&self.obj_id)
        .execute(conn)
        {
            Ok(1) => Ok(railjson_obj),
            Ok(_) => Err(Box::new(OperationError::ObjectNotFound(
                self.obj_id.clone(),
            ))),
            Err(err) => Err(err.into()),
        }
    }
}

#[derive(QueryableByName)]
struct DataObject {
    #[sql_type = "Jsonb"]
    data: Value,
}

impl DataObject {
    /// This function will patch the data object given an update operation.
    /// It will also check that the id of the id of the object is untouched and that the resulted data is valid.
    pub fn patch_and_check(
        &mut self,
        update: &UpdateOperation,
    ) -> Result<RailjsonObject, Box<dyn ApiError>> {
        json_patch::patch(&mut self.data, &update.railjson_patch)?;

        let obj_railjson = match update.obj_type {
            ObjectType::TrackSection => RailjsonObject::TrackSection {
                railjson: from_value::<TrackSection>(self.data.clone())?,
            },
            ObjectType::Signal => todo!(),
            ObjectType::SpeedSection => todo!(),
        };

        if obj_railjson.get_obj_id() != update.obj_id {
            return Err(Box::new(OperationError::ModifyId));
        }
        Ok(obj_railjson)
    }
}

#[cfg(test)]
mod test {
    use super::UpdateOperation;
    use crate::client::PostgresConfig;
    use crate::models::Infra;
    use crate::railjson::operation::create::apply_create_operation;
    use crate::railjson::operation::OperationError;
    use crate::railjson::operation::RailjsonObject;
    use crate::railjson::ObjectType;
    use crate::railjson::TrackSection;
    use crate::response::ApiError;
    use diesel::result::Error;
    use diesel::sql_query;
    use diesel::sql_types::Double;
    use diesel::RunQueryDsl;
    use diesel::{Connection, PgConnection};
    use serde_json::from_str;

    #[derive(QueryableByName)]
    struct Length {
        #[sql_type = "Double"]
        length: f64,
    }

    #[test]
    fn valide_update_track() {
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

            let update_track = UpdateOperation {
                obj_id: "my_track".to_string(),
                obj_type: ObjectType::TrackSection,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/length", "value": 80.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_track.apply(infra.id, &conn).is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'length')::float as length FROM osrd_infra_tracksectionmodel WHERE obj_id = 'my_track' AND infra_id = {}",
                infra.id
            ))
            .load::<Length>(&conn).unwrap();
            assert_eq!(updated_length[0].length, 80.0);

            Ok(())
        });
    }

    #[test]
    fn invalide_update_track() {
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

            let update_track = UpdateOperation {
                obj_id: "my_track".to_string(),
                obj_type: ObjectType::TrackSection,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/id", "value": "impossible_track" }
                  ]"#,
                )
                .unwrap(),
            };

            let res = update_track.apply(infra.id, &conn);

            assert!(res.is_err());
            assert_eq!(
                res.unwrap_err().get_type(),
                OperationError::ModifyId.get_type()
            );

            Ok(())
        });
    }
}
