use std::collections::HashSet;

use database::Db;
use schemas::primitives::ObjectType;
use sea_orm::ColumnTrait;
use sea_orm::Condition;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::QuerySelect;
use sea_orm::prelude::Expr;

use crate::sea_orm_types::ForeignJson;

pub type Domestic = (String, String, Option<String>);

pub trait ModelBackedSchema: Sized {
    type Model: Into<Self>;
}

macro_rules! infra_entity {
    ($module:ident, $table:literal, $data:path) => {
        infra_entity!(@ $module, $table, None, $data);
    };
    ($module:ident, $table:literal, $layer:literal, $data:path) => {
        infra_entity!(@ $module, $table, Some($layer), $data);
    };
    (@ $module:ident, $table:literal, $layer:expr, $data:path) => {
        pub mod $module {
            use std::ops::Deref;
            use std::ops::DerefMut;

            use sea_orm::entity::prelude::*;

            use super::ForeignJson;

            #[derive(Clone, Debug, DeriveEntityModel, PartialEq)]
            #[sea_orm(table_name = $table)]
            pub struct Model {
                #[sea_orm(primary_key)]
                pub id: i64,
                #[sea_orm(unique_key = "infra_id_obj_id")]
                pub obj_id: String,
                #[sea_orm(column_name = "data", column_type = "JsonBinary")]
                pub schema: ForeignJson<$data>,
                #[sea_orm(unique_key = "infra_id_obj_id")]
                pub infra_id: i64,
            }

            #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
            pub enum Relation {
                #[sea_orm(
                    belongs_to = "crate::infra::Entity",
                    from = "Column::InfraId",
                    to = "crate::infra::Column::Id",
                    on_update = "NoAction",
                    on_delete = "Cascade"
                )]
                Infra,
            }

            impl Related<crate::infra::Entity> for Entity {
                fn to() -> RelationDef {
                    Relation::Infra.def()
                }
            }

            impl ActiveModelBehavior for ActiveModel {}

            impl Model {
                pub const TABLE: &'static str = $table;
                pub const LAYER_TABLE: Option<&'static str> = $layer;

                /// Creates an active model for this infra object with its object ID and infra ID set
                pub fn from_schema(infra_id: i64, schema: $data) -> ActiveModel {
                    // TODO: remove the `id` field of the schemas and replace it by
                    // a `models::ObjectId` type, whose `Default` yields a new UUID
                    use schemas::primitives::OSRDIdentified as _;

                    ActiveModel {
                        obj_id: sea_orm::Set(schema.get_id().clone()),
                        schema: sea_orm::Set(ForeignJson::new(schema)),
                        infra_id: sea_orm::Set(infra_id),
                        ..Default::default()
                    }
                }

                /// Converts all schemas into active models of this infra object model
                ///
                /// Each active model will have the provided infra_id set.
                pub fn from_infra_schemas(
                    infra_id: i64,
                    schemas: impl IntoIterator<Item = $data>,
                ) -> Vec<ActiveModel> {
                    schemas
                        .into_iter()
                        .map(|schema| Self::from_schema(infra_id, schema))
                        .collect()
                }
            }

            impl Deref for Model {
                type Target = $data;

                fn deref(&self) -> &Self::Target {
                    self.schema.as_ref()
                }
            }

            impl DerefMut for Model {
                fn deref_mut(&mut self) -> &mut Self::Target {
                    &mut self.schema
                }
            }

            impl AsRef<$data> for Model {
                fn as_ref(&self) -> &$data {
                    self.schema.as_ref()
                }
            }

            impl AsMut<$data> for Model {
                fn as_mut(&mut self) -> &mut $data {
                    &mut self.schema
                }
            }

            impl From<Model> for $data {
                fn from(model: Model) -> Self {
                    model.schema.into_inner()
                }
            }

            impl super::ModelBackedSchema for $data {
                type Model = Model;
            }
        }
    };
}

infra_entity!(
    track_section,
    "infra_object_track_section",
    "infra_layer_track_section",
    schemas::infra::TrackSection
);
infra_entity!(
    buffer_stop,
    "infra_object_buffer_stop",
    "infra_layer_buffer_stop",
    schemas::infra::BufferStop
);
infra_entity!(
    electrification,
    "infra_object_electrification",
    "infra_layer_electrification",
    schemas::infra::Electrification
);
infra_entity!(
    detector,
    "infra_object_detector",
    "infra_layer_detector",
    schemas::infra::Detector
);
infra_entity!(
    operational_point,
    "infra_object_operational_point",
    "infra_layer_operational_point",
    schemas::infra::OperationalPoint
);
infra_entity!(route, "infra_object_route", schemas::infra::Route);
infra_entity!(
    signal,
    "infra_object_signal",
    "infra_layer_signal",
    schemas::infra::Signal
);
infra_entity!(
    switch,
    "infra_object_switch",
    "infra_layer_switch",
    schemas::infra::Switch
);
infra_entity!(
    speed_section,
    "infra_object_speed_section",
    "infra_layer_speed_section",
    schemas::infra::SpeedSection
);
infra_entity!(
    switch_type,
    "infra_object_extended_switch_type",
    schemas::infra::SwitchType
);
infra_entity!(
    neutral_section,
    "infra_object_neutral_section",
    "infra_layer_neutral_section",
    schemas::infra::NeutralSection
);
infra_entity!(
    level_crossing,
    "infra_object_level_crossing",
    "infra_layer_level_crossing",
    schemas::infra::LevelCrossing
);

pub fn get_table(object_type: &ObjectType) -> &'static str {
    match object_type {
        ObjectType::TrackSection => track_section::Model::TABLE,
        ObjectType::BufferStop => buffer_stop::Model::TABLE,
        ObjectType::Electrification => electrification::Model::TABLE,
        ObjectType::Detector => detector::Model::TABLE,
        ObjectType::OperationalPoint => operational_point::Model::TABLE,
        ObjectType::Route => route::Model::TABLE,
        ObjectType::Signal => signal::Model::TABLE,
        ObjectType::Switch => switch::Model::TABLE,
        ObjectType::SpeedSection => speed_section::Model::TABLE,
        ObjectType::SwitchType => switch_type::Model::TABLE,
        ObjectType::NeutralSection => neutral_section::Model::TABLE,
        ObjectType::LevelCrossing => level_crossing::Model::TABLE,
    }
}

/// Returns the layer table name of the given object type
///
/// Returns `None` for objects that doesn't have a layer such as routes or switch types.
pub fn get_geometry_layer_table(object_type: &ObjectType) -> Option<&'static str> {
    match object_type {
        ObjectType::TrackSection => track_section::Model::LAYER_TABLE,
        ObjectType::BufferStop => buffer_stop::Model::LAYER_TABLE,
        ObjectType::Electrification => electrification::Model::LAYER_TABLE,
        ObjectType::Detector => detector::Model::LAYER_TABLE,
        ObjectType::OperationalPoint => operational_point::Model::LAYER_TABLE,
        ObjectType::Route => route::Model::LAYER_TABLE,
        ObjectType::Signal => signal::Model::LAYER_TABLE,
        ObjectType::Switch => switch::Model::LAYER_TABLE,
        ObjectType::SpeedSection => speed_section::Model::LAYER_TABLE,
        ObjectType::SwitchType => switch_type::Model::LAYER_TABLE,
        ObjectType::NeutralSection => neutral_section::Model::LAYER_TABLE,
        ObjectType::LevelCrossing => level_crossing::Model::LAYER_TABLE,
    }
}

impl operational_point::Model {
    /// Retrieve a list of operational points from the database
    #[tracing::instrument(skip(db), err)]
    pub async fn retrieve_from_uic(
        db: Db,
        infra_id: i64,
        uic: &[u32],
    ) -> Result<Vec<Self>, crate::Error> {
        if uic.is_empty() {
            // We know the result of the SQL query is going to be empty, avoid sending it.
            return Ok(Vec::new());
        }

        let uic = uic.iter().copied().map(i64::from).collect::<Vec<_>>();
        let query = operational_point::Entity::find()
            .filter(operational_point::Column::InfraId.eq(infra_id))
            .filter(Expr::cust_with_values(
                "NULLIF(data->>'uic', 'null')::bigint = ANY($1)",
                [uic],
            ));
        query.all(&db).await.map_err(crate::Error::from)
    }

    #[tracing::instrument(skip(db), err)]
    pub async fn retrieve_from_domestics(
        db: Db,
        infra_id: i64,
        domestics: &[Domestic],
    ) -> Result<Vec<Self>, crate::Error> {
        if domestics.is_empty() {
            // We know the result of the SQL query is going to be empty, avoid sending it.
            return Ok(Vec::new());
        }

        let mut alternatives = Condition::any();
        for (country_code, main_code, secondary_code) in domestics {
            let mut domestic = Condition::all()
                .add(operational_point::Column::InfraId.eq(infra_id))
                .add(Expr::cust_with_values(
                    "data->>'country_code' = $1",
                    [country_code.clone()],
                ))
                .add(Expr::cust_with_values(
                    "data->>'main_code' = $1",
                    [main_code.clone()],
                ));
            domestic = if let Some(secondary_code) = secondary_code {
                domestic.add(Expr::cust_with_values(
                    "data->>'secondary_code' = $1",
                    [secondary_code.clone()],
                ))
            } else {
                domestic.add(Expr::cust("data->>'secondary_code' IS NULL"))
            };
            alternatives = alternatives.add(domestic);
        }

        operational_point::Entity::find()
            .filter(alternatives)
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }

    /// Retrieve the list of operational points that match the given (object) IDs
    ///
    /// Use this instead of an unchecked batch retrieval when all the operational points
    /// are known to be in the same infra.
    #[tracing::instrument(skip(db), err)]
    pub async fn retrieve_from_ids(
        db: Db,
        infra_id: i64,
        ids: &[String],
    ) -> Result<Vec<Self>, crate::Error> {
        if ids.is_empty() {
            // We know the result of the SQL query is going to be empty, avoid sending it.
            return Ok(Vec::new());
        }

        operational_point::Entity::find()
            .filter(operational_point::Column::InfraId.eq(infra_id))
            .filter(operational_point::Column::ObjId.is_in(ids.iter().cloned()))
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }
}

impl track_section::Model {
    /// Checks the existence of a list of track section ids.
    /// Returns only existing ids.
    #[tracing::instrument(skip(db), err)]
    pub async fn exists_from_ids(
        db: Db,
        infra_id: i64,
        ids: &[String],
    ) -> Result<HashSet<String>, crate::Error> {
        if ids.is_empty() {
            // We know the result of the SQL query is going to be empty, avoid sending it.
            return Ok(HashSet::new());
        }

        Ok(track_section::Entity::find()
            .select_only()
            .column(track_section::Column::ObjId)
            .filter(track_section::Column::InfraId.eq(infra_id))
            .filter(track_section::Column::ObjId.is_in(ids.iter().cloned()))
            .into_tuple::<String>()
            .all(&db)
            .await?
            .into_iter()
            .collect())
    }
}

#[cfg(test)]
mod tests_persist {
    use crate::infra;
    use database::Db;
    use sea_orm::EntityTrait as _;
    use sea_orm::Set;

    macro_rules! test_persist {
        ($obj:ident, $test_fn:ident) => {
            #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
            async fn $test_fn() {
                use super::$obj;

                let db = Db::for_tests().await;
                let railjson = schemas::fixtures::small_infra();
                let infra = infra::ActiveModel {
                    name: Set("small_infra".to_owned()),
                    ..Default::default()
                }
                .last_railjson_version()
                .persist(railjson, db.clone())
                .await
                .unwrap();
                let schemas = (0..10).map(|_| Default::default());
                let active_models = $obj::Model::from_infra_schemas(infra.id, schemas);
                assert!(
                    super::$obj::Entity::insert_many(active_models)
                        .exec(&db)
                        .await
                        .is_ok()
                );
            }
        };
    }

    test_persist!(track_section, test_persist_track_section_model);
    test_persist!(buffer_stop, test_persist_buffer_stop_model);
    test_persist!(electrification, test_persist_electrification_model);
    test_persist!(detector, test_persist_detector_model);
    test_persist!(operational_point, test_persist_operational_point_model);
    test_persist!(route, test_persist_route_model);
    test_persist!(signal, test_persist_signal_model);
    test_persist!(switch, test_persist_switch_model);
    test_persist!(speed_section, test_persist_speed_section_model);
    test_persist!(switch_type, test_persist_switch_type_model);
    test_persist!(neutral_section, test_persist_neutral_section_model);
    test_persist!(level_crossing, test_persist_level_crossing_model);
}

#[cfg(test)]
mod tests_retrieve {
    use super::operational_point;
    use crate::infra;
    use database::Db;
    use pretty_assertions::assert_eq;
    use sea_orm::Set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn from_main_codes() {
        let db = Db::for_tests().await;
        let railjson = schemas::fixtures::small_infra();
        let small_infra = infra::ActiveModel {
            name: Set("small_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .persist(railjson, db.clone())
        .await
        .unwrap();
        let domestics = vec![
            ("FR".to_string(), "MES".to_string(), Some("BV".to_string())),
            ("FR".to_string(), "WS".to_string(), Some("BV".to_string())),
        ];
        let res = operational_point::Model::retrieve_from_domestics(
            db.clone(),
            small_infra.id,
            &domestics,
        )
        .await
        .expect("Failed to retrieve operational points");

        assert_eq!(res.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn from_uic() {
        let db = Db::for_tests().await;
        let railjson = schemas::fixtures::small_infra();
        let small_infra = infra::ActiveModel {
            name: Set("small_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .persist(railjson, db.clone())
        .await
        .unwrap();
        let uic = vec![8711, 8722];
        let res = operational_point::Model::retrieve_from_uic(db.clone(), small_infra.id, &uic)
            .await
            .expect("Failed to retrieve operational points");

        assert_eq!(res.len(), 2);
    }
}
