use crate::modelsv2::prelude::*;
use crate::schema;
use crate::tables::*;
use editoast_derive::ModelV2;
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};

pub trait ModelBackedSchema {
    type Model: Model;
}

macro_rules! infra_model {
    ($name:ident, $table:ident, $data:path) => {
        #[derive(Debug, Clone, Default, Serialize, Deserialize, ModelV2)]
        #[model(table = $table)]
        #[model(preferred = (infra_id, obj_id))]
        pub struct $name {
            pub id: i64,
            pub obj_id: String,
            #[model(json, column = "data")]
            pub schema: $data,
            pub infra_id: i64,
        }

        impl ModelBackedSchema for $data {
            type Model = $name;
        }

        impl $name {
            /// Creates a changeset for this infra object with a random obj_id
            pub fn new_from_schema(schema: $data) -> Changeset<Self> {
                // TODO: remove the `id` field of the schemas and replace it by
                // a `modelsv2::ObjectId` type, whose `Default` yields a new UUID
                use crate::schema::OSRDIdentified;
                let obj_id = schema.get_id().clone();
                Self::changeset().schema(schema).obj_id(obj_id)
            }

            pub async fn persist_batch(
                conn: &mut diesel_async::AsyncPgConnection,
                infra_id: i64,
                schemas: impl IntoIterator<Item = $data>,
            ) -> crate::error::Result<()> {
                let cs = schemas
                    .into_iter()
                    .map(|schema| Self::new_from_schema(schema).infra_id(infra_id))
                    .collect::<Vec<_>>();
                let _: Vec<_> = Self::create_batch(conn, cs).await?;
                Ok(())
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
    schema::TrackSection
);

infra_model!(
    BufferStopModel,
    infra_object_buffer_stop,
    schema::BufferStop
);

infra_model!(
    ElectrificationModel,
    infra_object_electrification,
    schema::Electrification
);

infra_model!(DetectorModel, infra_object_detector, schema::Detector);

infra_model!(
    OperationalPointModel,
    infra_object_operational_point,
    schema::OperationalPoint
);

infra_model!(RouteModel, infra_object_route, schema::Route);

infra_model!(SignalModel, infra_object_signal, schema::Signal);

infra_model!(SwitchModel, infra_object_switch, schema::Switch);

infra_model!(
    SpeedSectionModel,
    infra_object_speed_section,
    schema::SpeedSection
);

infra_model!(
    SwitchTypeModel,
    infra_object_extended_switch_type,
    schema::SwitchType
);

infra_model!(
    NeutralSectionModel,
    infra_object_neutral_section,
    schema::NeutralSection
);

impl OperationalPointModel {
    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_uic(
        conn: &mut diesel_async::AsyncPgConnection,
        infra_id: i64,
        uic: &[i64],
    ) -> crate::error::Result<Vec<Self>> {
        use diesel::sql_query;
        use diesel::sql_types::{Array, BigInt};
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

    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_obj_ids(
        conn: &mut diesel_async::AsyncPgConnection,
        infra_id: i64,
        ids: &[String],
    ) -> crate::error::Result<Vec<Self>> {
        use diesel::sql_query;
        use diesel::sql_types::{Array, BigInt, Text};
        use diesel_async::RunQueryDsl;
        let query = "SELECT * FROM infra_object_operational_point
                                WHERE infra_id = $1 AND infra_object_operational_point.obj_id = ANY($2)".to_string();
        Ok(sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<Text>, _>(ids)
            .load(conn)
            .await?
            .into_iter()
            .map(Self::from_row)
            .collect())
    }
}

#[cfg(test)]
mod test_persist {
    use super::*;
    use diesel_async::scoped_futures::ScopedFutureExt;

    macro_rules! test_persist {
        ($obj:ident) => {
            paste::paste! {
                #[rstest::rstest]
                async fn [<test_persist_ $obj:snake>]() {
                    crate::models::infra::tests::test_infra_transaction(|conn, infra| {
                        async move {
                            let cs = (0..10).map(|_| Default::default());
                            assert!($obj::persist_batch(conn, infra.id.unwrap(), cs).await.is_ok());
                        }.scope_boxed()
                    }).await;
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
    test_persist!(SwitchModel);
    test_persist!(SpeedSectionModel);
    test_persist!(SwitchTypeModel);
    test_persist!(NeutralSectionModel);
}
