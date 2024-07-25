use std::ops::Deref;
use std::ops::DerefMut;

use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;

use crate::modelsv2::prelude::*;
use crate::tables::*;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectType;

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
    ) -> crate::error::Result<C>;
}

macro_rules! infra_model {
    ($name:ident, $table:ident, $data:path) => {
        infra_model!(@ $name, $table, None, $data);
    };
    ($name:ident, $table:ident, $layer:expr, $data:path) => {
        infra_model!(@ $name, $table, Some(stringify!($layer)), $data);
    };
    (@ $name:ident, $table:ident, $layer:expr, $data:path) => {
        #[derive(Debug, Clone, Default, Serialize, Deserialize, ModelV2)]
        #[model(table = $table)]
        #[model(preferred = (infra_id, obj_id))]
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
                // a `modelsv2::ObjectId` type, whose `Default` yields a new UUID
                use editoast_schemas::primitives::OSRDIdentified;
                let obj_id = schema.get_id().clone();
                Self::changeset().schema(schema).obj_id(obj_id)
            }

            async fn find_all<C: Default + std::iter::Extend<Self> + Send>(
                conn: &mut DbConnection,
                infra_id: i64,
            ) -> crate::error::Result<C> {
                use diesel::prelude::*;
                use diesel_async::RunQueryDsl;
                use futures::stream::TryStreamExt;
                use $table::dsl;
                Ok($table::table
                    .filter(dsl::infra_id.eq(infra_id))
                    .load_stream(conn)
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
    editoast_schemas::infra::TrackSection
);

infra_model!(
    BufferStopModel,
    infra_object_buffer_stop,
    infra_layer_buffer_stop,
    editoast_schemas::infra::BufferStop
);

infra_model!(
    ElectrificationModel,
    infra_object_electrification,
    infra_layer_electrification,
    editoast_schemas::infra::Electrification
);

infra_model!(
    DetectorModel,
    infra_object_detector,
    infra_layer_detector,
    editoast_schemas::infra::Detector
);

infra_model!(
    OperationalPointModel,
    infra_object_operational_point,
    infra_layer_operational_point,
    editoast_schemas::infra::OperationalPoint
);

infra_model!(
    RouteModel,
    infra_object_route,
    editoast_schemas::infra::Route
);

infra_model!(
    SignalModel,
    infra_object_signal,
    infra_layer_signal,
    editoast_schemas::infra::Signal
);

infra_model!(
    TrackNodeModel,
    infra_object_track_node,
    infra_layer_track_node,
    editoast_schemas::infra::TrackNode
);

infra_model!(
    SpeedSectionModel,
    infra_object_speed_section,
    infra_layer_speed_section,
    editoast_schemas::infra::SpeedSection
);

infra_model!(
    TrackNodeTypeModel,
    infra_object_extended_track_node_type,
    editoast_schemas::infra::TrackNodeType
);

infra_model!(
    NeutralSectionModel,
    infra_object_neutral_section,
    infra_layer_neutral_section,
    editoast_schemas::infra::NeutralSection
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
        ObjectType::TrackNode => TrackNodeModel::TABLE,
        ObjectType::SpeedSection => SpeedSectionModel::TABLE,
        ObjectType::TrackNodeType => TrackNodeTypeModel::TABLE,
        ObjectType::NeutralSection => NeutralSectionModel::TABLE,
    }
}

/// Returns the layer table name of the given object type
///
/// Returns `None` for objects that doesn't have a layer such as routes or track_node types.
pub fn get_geometry_layer_table(object_type: &ObjectType) -> Option<&'static str> {
    match object_type {
        ObjectType::TrackSection => TrackSectionModel::LAYER_TABLE,
        ObjectType::BufferStop => BufferStopModel::LAYER_TABLE,
        ObjectType::Electrification => ElectrificationModel::LAYER_TABLE,
        ObjectType::Detector => DetectorModel::LAYER_TABLE,
        ObjectType::OperationalPoint => OperationalPointModel::LAYER_TABLE,
        ObjectType::Route => RouteModel::LAYER_TABLE,
        ObjectType::Signal => SignalModel::LAYER_TABLE,
        ObjectType::TrackNode => TrackNodeModel::LAYER_TABLE,
        ObjectType::SpeedSection => SpeedSectionModel::LAYER_TABLE,
        ObjectType::TrackNodeType => TrackNodeTypeModel::LAYER_TABLE,
        ObjectType::NeutralSection => NeutralSectionModel::LAYER_TABLE,
    }
}

impl OperationalPointModel {
    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_uic(
        conn: &mut DbConnection,
        infra_id: i64,
        uic: &[i64],
    ) -> crate::error::Result<Vec<Self>> {
        use diesel::sql_query;
        use diesel::sql_types::Array;
        use diesel::sql_types::BigInt;
        use diesel_async::RunQueryDsl;
        let query = {
            "SELECT * FROM infra_object_operational_point
                WHERE infra_id = $1 AND (data->'extensions'->'identifier'->'uic')::integer = ANY($2)"
        }.to_string();
        Ok(sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<BigInt>, _>(uic)
            .load(conn)
            .await?
            .into_iter()
            .map(Self::from_row)
            .collect())
    }

    pub async fn retrieve_from_trigrams(
        conn: &mut DbConnection,
        infra_id: i64,
        trigrams: &[String],
    ) -> crate::error::Result<Vec<Self>> {
        use diesel::sql_query;
        use diesel::sql_types::Array;
        use diesel::sql_types::BigInt;
        use diesel::sql_types::Text;
        use diesel_async::RunQueryDsl;
        let query = {
            "SELECT * FROM infra_object_operational_point
                WHERE infra_id = $1 AND (data->'extensions'->'sncf'->>'trigram')::text = ANY($2)"
        }
        .to_string();
        Ok(sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<Text>, _>(trigrams)
            .load(conn)
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
        ($obj:ident) => {
            paste::paste! {
                #[rstest::rstest]
                async fn [<test_persist_ $obj:snake>]() {
                    let db_pool =  editoast_models::DbConnectionPoolV2::for_tests();
                    let infra =  crate::modelsv2::fixtures::create_empty_infra(db_pool.get_ok().deref_mut()).await;
                    let schemas = (0..10).map(|_| Default::default());
                    let changesets = $obj::from_infra_schemas(infra.id, schemas);
                    assert!($obj::create_batch::<_, Vec<_>>(db_pool.get_ok().deref_mut(), changesets).await.is_ok());
                }
            }
        };
    }

    test_persist!(TrackSectionModel);
    test_persist!(BufferStopModel);
    test_persist!(ElectrificationModel);
    test_persist!(DetectorModel);
    test_persist!(OperationalPointModel);
    test_persist!(RouteModel);
    test_persist!(SignalModel);
    test_persist!(TrackNodeModel);
    test_persist!(SpeedSectionModel);
    test_persist!(TrackNodeTypeModel);
    test_persist!(NeutralSectionModel);
}

#[cfg(test)]
mod tests_retrieve {
    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::small_infra;

    #[rstest::rstest]
    async fn from_trigrams() {
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let mut conn = pg_db_pool.get().await.unwrap();
        let trigrams = vec!["MES".to_string(), "WS".to_string()];
        let res =
            OperationalPointModel::retrieve_from_trigrams(&mut conn, small_infra.id, &trigrams)
                .await
                .expect("Failed to retrieve operational points");
        assert_eq!(res.len(), 2);
    }

    #[rstest::rstest]
    async fn from_uic() {
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let mut conn = pg_db_pool.get().await.unwrap();
        let uic = vec![1, 2];
        let res = OperationalPointModel::retrieve_from_uic(&mut conn, small_infra.id, &uic)
            .await
            .expect("Failed to retrieve operational points");
        assert_eq!(res.len(), 2);
    }
}
