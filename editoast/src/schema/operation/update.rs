use crate::error::Result;
use crate::schema::operation::RailjsonObject;
use crate::schema::{OSRDIdentified, ObjectType};
use diesel::result::Error as DieselError;
use diesel::sql_types::{BigInt, Json, Jsonb, Text};
use diesel::{sql_query, QueryableByName};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use json_patch::Patch;
use serde::{Deserialize, Serialize};
use serde_json::{from_value, json, Value};
use utoipa::ToSchema;

use super::OperationError;

#[derive(Clone, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
    /// The partial Railjson object patch to apply
    #[schema(value_type = Object)]
    railjson_patch: Patch,
}

impl UpdateOperation {
    pub async fn apply(&self, infra_id: i64, conn: &mut PgConnection) -> Result<RailjsonObject> {
        // Load object

        let mut obj: DataObject = match sql_query(format!(
            "SELECT data FROM {} WHERE infra_id = $1 AND obj_id = $2",
            self.obj_type.get_table()
        ))
        .bind::<BigInt, _>(infra_id)
        .bind::<Text, _>(&self.obj_id)
        .get_result(conn)
        .await
        {
            Ok(obj) => obj,
            Err(DieselError::NotFound) => {
                return Err(OperationError::ObjectNotFound {
                    obj_id: self.obj_id.clone(),
                    infra_id,
                }
                .into())
            }
            Err(err) => return Err(err.into()),
        };

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
        .await
        {
            Ok(1) => Ok(railjson_obj),
            Ok(_) => Err(OperationError::ObjectNotFound {
                obj_id: self.obj_id.clone(),
                infra_id,
            }
            .into()),
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
    pub fn patch_and_check(&mut self, update: &UpdateOperation) -> Result<RailjsonObject> {
        json_patch::patch(&mut self.data, &update.railjson_patch)
            .map_err(|err| OperationError::InvalidPatch(err.to_string()))?;

        let value = json!({
            "railjson": self.data,
            "obj_type": update.obj_type.to_string(),
        });

        let obj_railjson = match from_value::<RailjsonObject>(value) {
            Ok(obj) => obj,
            Err(err) => return Err(OperationError::InvalidPatch(err.to_string()).into()),
        };

        if obj_railjson.get_id() != &update.obj_id {
            return Err(OperationError::ModifyId.into());
        }
        Ok(obj_railjson)
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateOperation;
    use crate::error::EditoastError;
    use crate::models::infra::tests::test_infra_transaction;
    use crate::schema::operation::create::tests::{
        create_signal, create_speed, create_switch, create_track,
    };
    use crate::schema::operation::OperationError;
    use crate::schema::{OSRDIdentified, ObjectType};
    use actix_web::test as actix_test;
    use diesel::sql_query;
    use diesel::sql_types::{Double, Text};
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::RunQueryDsl;
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

    #[actix_test]
    async fn valid_update_track() {
        test_infra_transaction(|conn, infra| async move {
            let track = create_track(conn, infra.id.unwrap(), Default::default()).await;

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

            assert!(update_track.apply(infra.id.unwrap(), conn).await.is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'length')::float as val FROM infra_object_track_section WHERE obj_id = '{}' AND infra_id = {}",
                track.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Value>(conn).await.unwrap();

            assert_eq!(updated_length.val, 80.0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn invalid_update_track() {
        test_infra_transaction(|conn, infra| {
            async move {
                let track = create_track(conn, infra.id.unwrap(), Default::default()).await;

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

                let res = update_track.apply(infra.id.unwrap(), conn).await;

                assert!(res.is_err());
                assert_eq!(
                    res.unwrap_err().get_type(),
                    OperationError::ModifyId.get_type()
                );
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn valid_update_signal() {
        test_infra_transaction(|conn, infra| async move {
            let signal = create_signal(conn, infra.id.unwrap(), Default::default()).await;

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

            assert!(update_signal.apply(infra.id.unwrap(), conn).await.is_ok());

            let updated_length = sql_query(format!(
                "SELECT (data->>'sight_distance')::float as val FROM infra_object_signal WHERE obj_id = '{}' AND infra_id = {}",
                signal.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Value>(conn).await.unwrap();

            assert_eq!(updated_length.val, 15.0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn valid_update_switch_extension() {
        test_infra_transaction(|conn, infra| async move {
            let switch = create_switch(conn, infra.id.unwrap(), Default::default()).await;

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

            assert!(update_switch.apply(infra.id.unwrap(), conn).await.is_ok());

            let updated_comment = sql_query(format!(
                "SELECT (data->'extensions'->'sncf'->>'label') as label FROM infra_object_switch WHERE obj_id = '{}' AND infra_id = {}",
                switch.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Label>(conn).await.unwrap();

            assert_eq!(updated_comment.label, "Switch Label");
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn valid_update_speed() {
        test_infra_transaction(|conn, infra| async move {
            let speed = create_speed(conn, infra.id.unwrap(), Default::default()).await;

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

            assert!(update_speed.apply(infra.id.unwrap(), conn).await.is_ok());

            let updated_speed = sql_query(format!(
                "SELECT (data->>'speed_limit')::float as val FROM infra_object_speed_section WHERE obj_id = '{}' AND infra_id = {}",
                speed.get_id(),
                infra.id.unwrap()
            ))
            .get_result::<Value>(conn).await.unwrap();

            assert_eq!(updated_speed.val, 80.0);
        }.scope_boxed()).await;
    }

    #[actix_test]
    async fn wrong_id_update_track() {
        test_infra_transaction(|conn, infra| {
            async move {
                let update_track = UpdateOperation {
                    obj_id: "non_existent_id".to_string(),
                    obj_type: ObjectType::TrackSection,
                    railjson_patch: from_str(
                        r#"[
                    { "op": "replace", "path": "/length", "value": 80.0 }
                  ]"#,
                    )
                    .unwrap(),
                };

                let res = update_track.apply(infra.id.unwrap(), conn).await;

                assert!(res.is_err());
                assert_eq!(
                    res.unwrap_err().get_type(),
                    OperationError::ObjectNotFound {
                        obj_id: "non_existent_id".to_string(),
                        infra_id: infra.id.unwrap()
                    }
                    .get_type()
                );
            }
            .scope_boxed()
        })
        .await;
    }
}
