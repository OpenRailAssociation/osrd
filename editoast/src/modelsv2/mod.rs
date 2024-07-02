pub mod database;
pub mod documents;
pub mod electrical_profiles;
#[allow(unused)]
#[cfg(test)]
pub mod fixtures;
pub mod infra;
pub mod infra_objects;
pub mod light_rolling_stock;
// We allow unused until models is moved to a separate crate
pub mod pagination;
#[allow(unused)]
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

pub use database::DbConnection;
pub use database::DbConnectionPool;
pub use database::DbConnectionPoolV2;
pub use documents::Document;
pub use electrical_profiles::ElectricalProfileSet;
pub use infra::Infra;
pub use infra_objects::*;
pub use light_rolling_stock::LightRollingStockModel;
pub use projects::Project;
pub use projects::Tags;
pub use rolling_stock_image::RollingStockSeparatedImageModel;
pub use rolling_stock_model::RollingStockModel;
pub use scenario::Scenario;
pub use study::Study;

pub use crate::models::PreferredId;

editoast_common::schemas! {
    infra::schemas(),
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

    #[derive(Debug, Default, Clone, ModelV2, PartialEq, Eq)]
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

        #[derive(Debug, Clone, ModelV2)]
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

    #[rstest::rstest]
    async fn test_list() {
        // GIVEN
        let (multiple_ct, unique_ct) = ("models_test_list/multiple", "models_test_list/unique");
        let pool = db_pool();
        let conn = &mut pool.get().await.unwrap();
        let changesets = (0..20).map(|i| {
            Document::changeset()
                .content_type(multiple_ct.to_string())
                .data(vec![i])
        });
        let mut documents = Document::create_batch::<_, Vec<_>>(conn, changesets)
            .await
            .unwrap()
            .into_iter()
            .map(|d| TestFixture::new(d, pool.clone()))
            .collect::<Vec<_>>();
        let unique_doc_idx = 10;
        documents[unique_doc_idx]
            .patch()
            .content_type(unique_ct.to_string())
            .apply(conn)
            .await
            .unwrap();

        // WHEN
        let (list, multiple_count) = Document::list_and_count(
            conn,
            SelectionSettings::new()
                .filter(move || Document::CONTENT_TYPE.eq(multiple_ct.to_string()))
                .order_by(|| Document::ID.desc())
                .limit(10),
        )
        .await
        .unwrap();
        let (past_unique_ct_index, unique_count) = Document::list_and_count(
            conn,
            SelectionSettings::new()
                .filter(move || Document::CONTENT_TYPE.eq(unique_ct.to_string()))
                .offset(15),
        )
        .await
        .unwrap();
        let (with_unique, unique_count_bis) = Document::list_and_count(
            conn,
            SelectionSettings::new()
                .filter(move || Document::CONTENT_TYPE.eq(unique_ct.to_string())),
        )
        .await
        .unwrap();

        // THEN
        assert_eq!(multiple_count, 19);
        assert_eq!(list.len(), 10);
        assert_eq!(
            list.iter().collect::<Vec<&Document>>(),
            documents[9..20]
                .iter()
                .filter(|&f| f.id != documents[unique_doc_idx].id)
                .map(|f| &f.model)
                .rev()
                .collect::<Vec<&Document>>()
        );
        assert_eq!(unique_count, 1);
        assert!(past_unique_ct_index.is_empty());
        assert_eq!(unique_count_bis, 1);
        assert_eq!(with_unique.len(), 1);
        assert_eq!(with_unique[0], documents[unique_doc_idx].model);
    }
}
