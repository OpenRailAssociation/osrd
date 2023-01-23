use super::OperationError;
use crate::api_error::ApiError;

use crate::schema::operation::RailjsonObject;
use crate::schema::{OSRDIdentified, ObjectType};
use diesel::sql_types::{BigInt, Json, Jsonb, Text};
use diesel::{sql_query, PgConnection, QueryableByName, RunQueryDsl};
use json_patch::Patch;
use serde::{Deserialize, Serialize};
use serde_json::{from_value, Value};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
    railjson_patch: Patch,
}

impl UpdateOperation {
    pub fn apply(
        &self,
        infra_id: i64,
        conn: &mut PgConnection,
    ) -> Result<RailjsonObject, Box<dyn ApiError>> {
        // Load object

        let mut obj: DataObject = sql_query(format!(
            "SELECT data FROM {} WHERE infra_id = $1 AND obj_id = $2",
            self.obj_type.get_table()
        ))
        .bind::<BigInt, _>(infra_id)
        .bind::<Text, _>(&self.obj_id)
        .get_result(conn)?;

        // Apply and check patch
        let railjson_obj = obj.patch_and_check(self)?;

        // Save new object
        match sql_query(format!(
            "UPDATE {} SET data = $1 WHERE infra_id = $2 AND obj_id = $3",
            self.obj_type.get_table()
        ))
        .bind::<Json, _>(obj.data)
        .bind::<BigInt, _>(infra_id)
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
    #[diesel(sql_type = Jsonb)]
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
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::Signal => RailjsonObject::Signal {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::SpeedSection => RailjsonObject::SpeedSection {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::Detector => RailjsonObject::Detector {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::TrackSectionLink => RailjsonObject::TrackSectionLink {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::Switch => RailjsonObject::Switch {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::SwitchType => RailjsonObject::SwitchType {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::BufferStop => RailjsonObject::BufferStop {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::Route => RailjsonObject::Route {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::OperationalPoint => RailjsonObject::OperationalPoint {
                railjson: from_value(self.data.clone())?,
            },
            ObjectType::Catenary => RailjsonObject::Catenary {
                railjson: from_value(self.data.clone())?,
            },
        };

        if obj_railjson.get_id() != &update.obj_id {
            return Err(Box::new(OperationError::ModifyId));
        }
        Ok(obj_railjson)
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateOperation;
    use crate::api_error::ApiError;
    use crate::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::tests::{
        create_signal, create_speed, create_switch, create_track,
    };
    use crate::schema::operation::OperationError;
    use crate::schema::{OSRDIdentified, ObjectType};
    use diesel::sql_query;
    use diesel::sql_types::{Double, Text};
    use diesel::RunQueryDsl;
    use serde_json::from_str;

    #[derive(QueryableByName)]
    struct Value {
        #[diesel(sql_type = Double)]
        val: f64,
    }

    #[derive(QueryableByName)]
    struct Label {
        #[diesel(sql_type = Text)]
        label: String,
    }

    #[test]
    fn valid_update_track() {
        test_infra_transaction(|conn, infra| {
            let track = create_track(conn, infra.id, Default::default());

            let update_track = UpdateOperation {
                obj_id: track.get_id().clone(),
                obj_type: ObjectType::TrackSection,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/length", "value": 80.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_track.apply(infra.id, conn).is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'length')::float as val FROM osrd_infra_tracksectionmodel WHERE obj_id = '{}' AND infra_id = {}",
                track.get_id(),
                infra.id
            ))
            .get_result::<Value>(conn).unwrap();

            assert_eq!(updated_length.val, 80.0);
        });
    }

    #[test]
    fn invalid_update_track() {
        test_infra_transaction(|conn, infra| {
            let track = create_track(conn, infra.id, Default::default());

            let update_track = UpdateOperation {
                obj_id: track.get_id().clone(),
                obj_type: ObjectType::TrackSection,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/id", "value": "impossible_track" }
                  ]"#,
                )
                .unwrap(),
            };

            let res = update_track.apply(infra.id, conn);

            assert!(res.is_err());
            assert_eq!(
                res.unwrap_err().get_type(),
                OperationError::ModifyId.get_type()
            );
        });
    }

    #[test]
    fn valid_update_signal() {
        test_infra_transaction(|conn, infra| {
            let signal = create_signal(conn, infra.id, Default::default());

            let update_signal = UpdateOperation {
                obj_id: signal.get_id().clone(),
                obj_type: ObjectType::Signal,
                railjson_patch: from_str(
                    r#"[
                    { "op": "replace", "path": "/sight_distance", "value": 15.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_signal.apply(infra.id, conn).is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'sight_distance')::float as val FROM osrd_infra_signalmodel WHERE obj_id = '{}' AND infra_id = {}",
                signal.get_id(),
                infra.id
            ))
            .get_result::<Value>(conn).unwrap();

            assert_eq!(updated_length.val, 15.0);
        });
    }

    #[test]
    fn valid_update_switch_extension() {
        test_infra_transaction(|conn, infra| {
            let switch = create_switch(conn, infra.id, Default::default());

            let update_switch = UpdateOperation {
                obj_id: switch.get_id().clone(),
                obj_type: ObjectType::Switch,
                railjson_patch: from_str(
                    r#"[
                        { "op": "add", "path": "/extensions/sncf", "value": {"label": "Switch Label"} }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_switch.apply(infra.id, conn).is_ok());

            let updated_comment = sql_query(format!(
                "SELECT (data->'extensions'->'sncf'->>'label') as label FROM osrd_infra_switchmodel WHERE obj_id = '{}' AND infra_id = {}",
                switch.get_id(),
                infra.id
            ))
            .get_result::<Label>(conn).unwrap();

            assert_eq!(updated_comment.label, "Switch Label");
        });
    }

    #[test]
    fn valid_update_speed() {
        test_infra_transaction(|conn, infra| {
            let speed = create_speed(conn, infra.id, Default::default());

            let update_speed = UpdateOperation {
                obj_id: speed.get_id().clone(),
                obj_type: ObjectType::SpeedSection,
                railjson_patch: from_str(
                    r#"[
                        { "op": "replace", "path": "/speed_limit", "value": 80.0 }
                  ]"#,
                )
                .unwrap(),
            };

            assert!(update_speed.apply(infra.id, conn).is_ok());

            let updated_speed = sql_query(format!(
                "SELECT (data->>'speed_limit')::float as val FROM osrd_infra_speedsectionmodel WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_id(),
                infra.id
            ))
            .get_result::<Value>(conn).unwrap();

            assert_eq!(updated_speed.val, 80.0);
        });
    }
}
