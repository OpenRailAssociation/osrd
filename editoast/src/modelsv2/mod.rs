pub mod connection_pool;
pub mod documents;
pub mod electrical_profiles;
pub mod infra;
pub mod infra_objects;
pub mod light_rolling_stock;
pub mod prelude;
pub mod projects;
pub mod railjson;
pub mod rolling_stock_image;
pub mod rolling_stock_livery;
pub mod rolling_stock_model;
pub mod scenario;
pub mod study;
pub mod timetable;
pub mod train_schedule;
pub mod work_schedules;

pub use prelude::*;

pub use connection_pool::DbConnection;
pub use connection_pool::DbConnectionPool;
pub use documents::Document;
pub use electrical_profiles::ElectricalProfileSet;
pub use infra::Infra;
pub use infra_objects::*;
pub use light_rolling_stock::LightRollingStockModel;
pub use projects::Ordering;
pub use projects::Project;
pub use projects::Tags;
pub use rolling_stock_image::RollingStockSeparatedImageModel;
pub use rolling_stock_model::RollingStockModel;
pub use study::Study;

pub use crate::models::PreferredId;

editoast_common::schemas! {
    rolling_stock_model::schemas(),
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use editoast_derive::ModelV2;
    use itertools::Itertools;

    use super::prelude::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::TestFixture;

    #[derive(Debug, Default, Clone, ModelV2)]
    #[model(table = crate::tables::document)]
    struct Document {
        id: i64,
        content_type: String,
        data: Vec<u8>,
    }

    #[rstest::rstest]
    async fn test_batch() {
        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();
        let changesets = (0..5).map(|i| {
            Document::changeset()
                .content_type(String::from("text/plain"))
                .data(vec![i])
        });
        let docs = Document::create_batch::<_, Vec<_>>(&mut conn, changesets)
            .await
            .unwrap()
            .into_iter()
            .map(|d| TestFixture::new(d, pool.clone()))
            .collect::<Vec<_>>();
        assert_eq!(docs.len(), 5);

        let mut ids = docs.iter().map(|d| d.model.id).collect::<Vec<_>>();
        ids.push(123456789);

        let (docs, missing): (Vec<_>, _) =
            Document::retrieve_batch(&mut pool.get().await.unwrap(), ids.clone())
                .await
                .unwrap();
        assert_eq!(missing.into_iter().collect_vec(), vec![123456789]);
        assert_eq!(docs.len(), 5);
        assert_eq!(
            docs.iter()
                .map(|d| d.content_type.clone())
                .collect::<HashSet<_>>(),
            HashSet::from([String::from("text/plain")])
        );
        assert_eq!(
            docs.iter()
                .flat_map(|d| d.data.clone())
                .collect::<HashSet<_>>(),
            HashSet::from_iter(0..5)
        );

        let new_ct = String::from("I like trains");
        let (updated_docs, missing): (Vec<_>, _) = Document::changeset()
            .content_type(new_ct.clone())
            .update_batch(&mut pool.get().await.unwrap(), ids.iter().cloned().take(2))
            .await
            .unwrap();
        assert!(missing.is_empty());
        assert!(updated_docs.iter().all(|d| d.content_type == new_ct));
        assert_eq!(updated_docs.len(), 2);

        let (docs, _): (Vec<_>, _) =
            Document::retrieve_batch(&mut pool.get().await.unwrap(), ids.clone())
                .await
                .unwrap();
        assert_eq!(
            docs.iter()
                .map(|d| d.content_type.clone())
                .collect::<HashSet<_>>(),
            HashSet::from([String::from("text/plain"), new_ct])
        );

        let not_deleted = ids.remove(0);
        let count = Document::delete_batch(&mut pool.get().await.unwrap(), ids)
            .await
            .unwrap();
        assert_eq!(count, 4);

        assert!(
            Document::exists(&mut pool.get().await.unwrap(), not_deleted)
                .await
                .unwrap()
        );
    }

    #[rstest::rstest]
    async fn test_remote() {
        #[derive(Debug, Clone, PartialEq)]
        enum Data {
            Prefixed(u8),
            Raw(u8, u8),
        }

        impl From<Vec<u8>> for Data {
            fn from(v: Vec<u8>) -> Self {
                match v.as_slice() {
                    [0x42, x] => Data::Prefixed(*x),
                    [x, y] => Data::Raw(*x, *y),
                    _ => panic!("invalid 2-bytes data"),
                }
            }
        }

        impl From<Data> for Vec<u8> {
            fn from(d: Data) -> Self {
                match d {
                    Data::Prefixed(x) => vec![0x42, x],
                    Data::Raw(x, y) => vec![x, y],
                }
            }
        }

        #[derive(Clone, ModelV2)]
        #[model(table = crate::tables::document)]
        struct Document {
            id: i64,
            content_type: String,
            #[model(remote = "Vec<u8>")]
            data: Data,
        }

        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();
        let docs = Document::create_batch::<_, Vec<_>>(
            &mut conn,
            [
                Document::changeset()
                    .content_type(String::from("text/plain"))
                    .data(Data::Prefixed(0x43)),
                Document::changeset()
                    .content_type(String::from("text/plain"))
                    .data(Data::Raw(0, 1)),
            ],
        )
        .await
        .unwrap()
        .into_iter()
        .map(|d| TestFixture::new(d, pool.clone()))
        .collect::<Vec<_>>();
        assert_eq!(docs.len(), 2);

        let ids = docs.iter().map(|d| d.model.id).collect::<Vec<_>>();
        assert_eq!(
            Document::retrieve(&mut conn, ids[0])
                .await
                .unwrap()
                .unwrap()
                .data,
            Data::Prefixed(0x43)
        );
        assert_eq!(
            Document::retrieve(&mut conn, ids[1])
                .await
                .unwrap()
                .unwrap()
                .data,
            Data::Raw(0, 1)
        );
    }
}
