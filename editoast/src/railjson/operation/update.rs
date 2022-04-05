use super::OperationError;
use crate::error::ApiError;
use crate::railjson::operation::RailjsonObject;
use crate::railjson::{ObjectType, Signal, SpeedSection, TrackSection};
use diesel::sql_types::{Integer, Json, Jsonb, Text};
use diesel::{sql_query, PgConnection, QueryableByName, RunQueryDsl};
use json_patch::Patch;
use serde::Deserialize;
use serde_json::{from_value, Value};

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
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
            ObjectType::Signal => RailjsonObject::Signal {
                railjson: from_value::<Signal>(self.data.clone())?,
            },
            ObjectType::SpeedSection => RailjsonObject::SpeedSection {
                railjson: from_value::<SpeedSection>(self.data.clone())?,
            },
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
    use crate::error::ApiError;
    use crate::models::Infra;
    use crate::railjson::operation::create::apply_create_operation;
    use crate::railjson::operation::{OperationError, RailjsonObject};
    use crate::railjson::ObjectType;
    use diesel::result::Error;
    use diesel::sql_query;
    use diesel::sql_types::{Double, Text};
    use diesel::RunQueryDsl;
    use diesel::{Connection, PgConnection};
    use serde_json::from_str;

    #[derive(QueryableByName)]
    struct Value {
        #[sql_type = "Double"]
        val: f64,
    }

    #[derive(QueryableByName)]
    struct Comment {
        #[sql_type = "Text"]
        comment: String,
    }

    #[test]
    fn valide_update_track() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let track_creation = RailjsonObject::TrackSection {
                railjson: Default::default()
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
                "SELECT (data->>'length')::float as val FROM osrd_infra_tracksectionmodel WHERE obj_id = 'my_track' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Value>(&conn).unwrap();

            assert_eq!(updated_length.val, 80.0);

            Ok(())
        });
    }

    #[test]
    fn invalide_update_track() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let track_creation = RailjsonObject::TrackSection {
                railjson: Default::default(),
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

    #[test]
    fn valide_update_signal() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let signal_creation = RailjsonObject::Signal {
                railjson: Default::default()
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&signal_creation, infra.id, &conn).is_ok());

            let update_signal = UpdateOperation {
                obj_id: "my_signal".to_string(),
                obj_type: ObjectType::Signal,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/sight_distance", "value": 15.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_signal.apply(infra.id, &conn).is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'sight_distance')::float as val FROM osrd_infra_signalmodel WHERE obj_id = 'my_signal' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Value>(&conn).unwrap();

            assert_eq!(updated_length.val, 15.0);

            Ok(())
        });
    }

    #[test]
    fn valide_update_signal_optionnal() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let signal_creation = RailjsonObject::Signal {
                railjson: Default::default()
            };
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&signal_creation, infra.id, &conn).is_ok());

            let update_signal = UpdateOperation {
                obj_id: "my_signal".to_string(),
                obj_type: ObjectType::Signal,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/comment", "value": "Test Passed" }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_signal.apply(infra.id, &conn).is_ok());

            let updated_comment = sql_query(format!(
                "SELECT (data->>'comment') as comment FROM osrd_infra_signalmodel WHERE obj_id = 'my_signal' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Comment>(&conn).unwrap();

            assert_eq!(updated_comment.comment, "Test Passed");

            Ok(())
        });
    }

    #[test]
    fn valide_update_speed() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let speed_creation = RailjsonObject::SpeedSection {
                railjson: Default::default()
            };

            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(apply_create_operation(&speed_creation, infra.id, &conn).is_ok());

            let update_speed = UpdateOperation {
                obj_id: "my_speed".to_string(),
                obj_type: ObjectType::SpeedSection,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/speed", "value": 80.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_speed.apply(infra.id, &conn).is_ok());

            let updated_speed = sql_query(format!(
                "SELECT (data->>'speed')::float as val FROM osrd_infra_speedsectionmodel WHERE obj_id = 'my_speed' AND infra_id = {}",
                infra.id
            ))
            .get_result::<Value>(&conn).unwrap();

            assert_eq!(updated_speed.val, 80.0);

            Ok(())
        });
    }
}
