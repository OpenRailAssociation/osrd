use std::ops::Deref;
use std::ops::DerefMut;

use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;

use database::DbConnection;
use database::tables::*;
use editoast_models::prelude::*;
use schemas::primitives::ObjectType;

pub trait ModelBackedSchema: Sized {
    type Model: SchemaModel + Into<Self>;
}

pub trait SchemaModel: Model {
    type Schema: ModelBackedSchema;

    const TABLE: &'static str;
    const LAYER_TABLE: Option<&'static str>;

    /// Creates a changeset for this infra object with a random obj_id and no infra_id set
    fn new_from_schema(schema: Self::Schema) -> Changeset<Self>;

    /// Retrieve all objects of this type from the database for a given infra
    async fn find_all<C: Default + std::iter::Extend<Self> + Send>(
        conn: &mut DbConnection,
        infra_id: i64,
    ) -> Result<C, database::DatabaseError>;
}

macro_rules! infra_model {
    ($name:ident, $table:ident, $data:path) => {
        infra_model!(@ $name, $table, None, $data);
    };
    ($name:ident, $table:ident, $layer:expr, $data:path) => {
        infra_model!(@ $name, $table, Some(stringify!($layer)), $data);
    };
    (@ $name:ident, $table:ident, $layer:expr, $data:path) => {
        #[derive(Debug, Clone, Default, Serialize, Deserialize, Model)]
        #[model(table = $table)]
        #[model(preferred = (infra_id, obj_id))]
        #[model(gen(ops = crud, batch_ops = crud, list))]
        pub struct $name {
            pub id: i64,
            pub obj_id: String,
            #[model(json, column = $table::data)]
            pub schema: $data,
            pub infra_id: i64,
        }

        impl ModelBackedSchema for $data {
            type Model = $name;
        }

        impl SchemaModel for $name {
            type Schema = $data;

            const TABLE: &'static str = stringify!($table);
            const LAYER_TABLE: Option<&'static str> = $layer;

            fn new_from_schema(schema: Self::Schema) -> Changeset<Self> {
                // TODO: remove the `id` field of the schemas and replace it by
                // a `models::ObjectId` type, whose `Default` yields a new UUID
                use schemas::primitives::OSRDIdentified;
                let obj_id = schema.get_id().clone();
                Self::changeset().schema(schema).obj_id(obj_id)
            }

            async fn find_all<C: Default + std::iter::Extend<Self> + Send>(
                conn: &mut DbConnection,
                infra_id: i64,
            ) -> Result<C, database::DatabaseError> {
                use diesel::prelude::*;
                use diesel_async::RunQueryDsl;
                use futures::stream::TryStreamExt;
                use $table::dsl;
                Ok($table::table
                    .filter(dsl::infra_id.eq(infra_id))
                    .load_stream(conn.write().await.deref_mut())
                    .await?
                    .map_ok(Self::from_row)
                    .try_collect::<C>()
                    .await?)
            }
        }

        impl $name {
            /// Converts all schemas into changesets of this infra object model
            ///
            /// Each changeset will have a random obj_id and the provided infra_id set.
            pub fn from_infra_schemas(
                infra_id: i64,
                schemas: impl IntoIterator<Item = $data>,
            ) -> Vec<Changeset<Self>> {
                schemas
                    .into_iter()
                    .map(|schema| Self::new_from_schema(schema).infra_id(infra_id))
                    .collect()
            }
        }

        impl Deref for $name {
            type Target = $data;

            fn deref(&self) -> &Self::Target {
                &self.schema
            }
        }

        impl DerefMut for $name {
            fn deref_mut(&mut self) -> &mut Self::Target {
                &mut self.schema
            }
        }

        impl AsRef<$data> for $name {
            fn as_ref(&self) -> &$data {
                &self.schema
            }
        }

        impl AsMut<$data> for $name {
            fn as_mut(&mut self) -> &mut $data {
                &mut self.schema
            }
        }

        impl From<$name> for $data {
            fn from(model: $name) -> Self {
                model.schema
            }
        }
    };
}

infra_model!(
    TrackSectionModel,
    infra_object_track_section,
    infra_layer_track_section,
    schemas::infra::TrackSection
);

infra_model!(
    BufferStopModel,
    infra_object_buffer_stop,
    infra_layer_buffer_stop,
    schemas::infra::BufferStop
);

infra_model!(
    ElectrificationModel,
    infra_object_electrification,
    infra_layer_electrification,
    schemas::infra::Electrification
);

infra_model!(
    DetectorModel,
    infra_object_detector,
    infra_layer_detector,
    schemas::infra::Detector
);

infra_model!(
    OperationalPointModel,
    infra_object_operational_point,
    infra_layer_operational_point,
    schemas::infra::OperationalPoint
);

infra_model!(RouteModel, infra_object_route, schemas::infra::Route);

infra_model!(
    SignalModel,
    infra_object_signal,
    infra_layer_signal,
    schemas::infra::Signal
);

infra_model!(
    SwitchModel,
    infra_object_switch,
    infra_layer_switch,
    schemas::infra::Switch
);

infra_model!(
    SpeedSectionModel,
    infra_object_speed_section,
    infra_layer_speed_section,
    schemas::infra::SpeedSection
);

infra_model!(
    SwitchTypeModel,
    infra_object_extended_switch_type,
    schemas::infra::SwitchType
);

infra_model!(
    NeutralSectionModel,
    infra_object_neutral_section,
    infra_layer_neutral_section,
    schemas::infra::NeutralSection
);

pub fn get_table(object_type: &ObjectType) -> &'static str {
    match object_type {
        ObjectType::TrackSection => TrackSectionModel::TABLE,
        ObjectType::BufferStop => BufferStopModel::TABLE,
        ObjectType::Electrification => ElectrificationModel::TABLE,
        ObjectType::Detector => DetectorModel::TABLE,
        ObjectType::OperationalPoint => OperationalPointModel::TABLE,
        ObjectType::Route => RouteModel::TABLE,
        ObjectType::Signal => SignalModel::TABLE,
        ObjectType::Switch => SwitchModel::TABLE,
        ObjectType::SpeedSection => SpeedSectionModel::TABLE,
        ObjectType::SwitchType => SwitchTypeModel::TABLE,
        ObjectType::NeutralSection => NeutralSectionModel::TABLE,
    }
}

/// Returns the layer table name of the given object type
///
/// Returns `None` for objects that doesn't have a layer such as routes or switch types.
pub fn get_geometry_layer_table(object_type: &ObjectType) -> Option<&'static str> {
    match object_type {
        ObjectType::TrackSection => TrackSectionModel::LAYER_TABLE,
        ObjectType::BufferStop => BufferStopModel::LAYER_TABLE,
        ObjectType::Electrification => ElectrificationModel::LAYER_TABLE,
        ObjectType::Detector => DetectorModel::LAYER_TABLE,
        ObjectType::OperationalPoint => OperationalPointModel::LAYER_TABLE,
        ObjectType::Route => RouteModel::LAYER_TABLE,
        ObjectType::Signal => SignalModel::LAYER_TABLE,
        ObjectType::Switch => SwitchModel::LAYER_TABLE,
        ObjectType::SpeedSection => SpeedSectionModel::LAYER_TABLE,
        ObjectType::SwitchType => SwitchTypeModel::LAYER_TABLE,
        ObjectType::NeutralSection => NeutralSectionModel::LAYER_TABLE,
    }
}

impl OperationalPointModel {
    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_uic(
        conn: &mut DbConnection,
        infra_id: i64,
        uic: &[u32],
    ) -> Result<Vec<Self>, database::DatabaseError> {
        use database::tables::infra_object_operational_point::dsl;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::*;
        use diesel_async::RunQueryDsl;
        let uic: Vec<i64> = uic.iter().map(|&u| i64::from(u)).collect();

        Ok(dsl::infra_object_operational_point
            .filter(dsl::infra_id.eq(infra_id))
            .filter(
                sql::<Nullable<BigInt>>("(data->'extensions'->'identifier'->'uic')::int")
                    .eq_any(uic),
            )
            .load(&mut conn.write().await)
            .await?
            .into_iter()
            .map(Self::from_row)
            .collect())
    }

    pub async fn retrieve_from_trigrams(
        conn: &mut DbConnection,
        infra_id: i64,
        trigrams: &[String],
    ) -> Result<Vec<Self>, database::DatabaseError> {
        use database::tables::infra_object_operational_point::dsl;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::*;
        use diesel_async::RunQueryDsl;

        Ok(dsl::infra_object_operational_point
            .filter(dsl::infra_id.eq(infra_id))
            .filter(
                sql::<Nullable<Text>>("data->'extensions'->'sncf'->>'trigram'").eq_any(trigrams),
            )
            .load(&mut conn.write().await)
            .await?
            .into_iter()
            .map(Self::from_row)
            .collect())
    }
}

#[cfg(test)]
mod tests_persist {
    use super::*;

    macro_rules! test_persist {
        ($obj:ident, $test_fn:ident) => {
            #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
            async fn $test_fn() {
                let db_pool = database::DbConnectionPoolV2::for_tests();
                let infra =
                    crate::models::fixtures::create_empty_infra(&mut db_pool.get_ok()).await;
                let schemas = (0..10).map(|_| Default::default());
                let changesets = $obj::from_infra_schemas(infra.id, schemas);
                assert!(
                    $obj::create_batch::<_, Vec<_>>(&mut db_pool.get_ok(), changesets)
                        .await
                        .is_ok()
                );
            }
        };
    }

    test_persist!(TrackSectionModel, test_persist_track_section_model);
    test_persist!(BufferStopModel, test_persist_buffer_stop_model);
    test_persist!(ElectrificationModel, test_persist_electrification_model);
    test_persist!(DetectorModel, test_persist_detector_model);
    test_persist!(OperationalPointModel, test_persist_operational_point_model);
    test_persist!(RouteModel, test_persist_route_model);
    test_persist!(SignalModel, test_persist_signal_model);
    test_persist!(SwitchModel, test_persist_switch_model);
    test_persist!(SpeedSectionModel, test_persist_speed_section_model);
    test_persist!(SwitchTypeModel, test_persist_switch_type_model);
    test_persist!(NeutralSectionModel, test_persist_neutral_section_model);
}

#[cfg(test)]
mod tests_retrieve {
    use database::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::models::fixtures::create_small_infra;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn from_trigrams() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let trigrams = vec!["MES".to_string(), "WS".to_string()];
        let res = OperationalPointModel::retrieve_from_trigrams(
            &mut db_pool.get_ok(),
            small_infra.id,
            &trigrams,
        )
        .await
        .expect("Failed to retrieve operational points");

        assert_eq!(res.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn from_uic() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let uic = vec![8711, 8722];
        let res =
            OperationalPointModel::retrieve_from_uic(&mut db_pool.get_ok(), small_infra.id, &uic)
                .await
                .expect("Failed to retrieve operational points");

        assert_eq!(res.len(), 2);
    }
}
