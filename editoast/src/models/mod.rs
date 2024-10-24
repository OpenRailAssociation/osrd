pub mod documents;
pub mod electrical_profiles;
#[allow(unused)]
#[cfg(test)]
pub mod fixtures;
pub mod infra;
pub mod infra_objects;
pub mod layers;
pub mod macro_node;
// We allow unused until models is moved to a separate crate
pub mod auth;
pub mod pagination;
#[allow(unused)]
pub mod prelude;
pub mod projects;
pub mod railjson;
pub mod rolling_stock_image;
pub mod rolling_stock_livery;
pub mod rolling_stock_model;
pub mod scenario;
pub mod stdcm_search_environment;
pub mod study;
pub mod tags;
pub mod temporary_speed_limits;
pub mod timetable;
pub mod towed_rolling_stock;
pub mod train_schedule;
pub mod work_schedules;

pub use prelude::*;

pub use documents::Document;
pub use infra::Infra;
pub use infra_objects::*;
pub use projects::Project;
pub use rolling_stock_image::RollingStockSeparatedImageModel;
pub use rolling_stock_model::RollingStockModel;
pub use scenario::Scenario;
pub use study::Study;
pub use tags::Tags;

editoast_common::schemas! {
    infra::schemas(),
    projects::schemas(),
    rolling_stock_model::schemas(),
    tags::schemas(),
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use editoast_derive::Model;
    use editoast_models::DbConnectionPoolV2;
    use itertools::Itertools;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::prelude::*;

    #[derive(Debug, Default, Clone, Model, PartialEq, Eq)]
    #[model(table = editoast_models::tables::document)]
    #[model(gen(ops = crud, batch_ops = crud, list))]
    struct Document {
        id: i64,
        content_type: String,
        data: Vec<u8>,
    }

    #[rstest]
    async fn test_batch() {
        let pool = DbConnectionPoolV2::for_tests();

        let changesets = (0..5).map(|i| {
            Document::changeset()
                .content_type(String::from("text/plain"))
                .data(vec![i])
        });

        let docs = Document::create_batch::<_, Vec<_>>(&mut pool.get_ok(), changesets)
            .await
            .expect("Failed to create documents");
        assert_eq!(docs.len(), 5);

        let mut ids = docs.iter().map(|d| d.id).collect::<Vec<_>>();
        ids.push(123456789);

        let (docs, missing): (Vec<_>, _) =
            Document::retrieve_batch(&mut pool.get_ok(), ids.clone())
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
            .update_batch(&mut pool.get_ok(), ids.iter().cloned().take(2))
            .await
            .expect("Failed to update documents");
        assert!(missing.is_empty());
        assert!(updated_docs.iter().all(|d| d.content_type == new_ct));
        assert_eq!(updated_docs.len(), 2);

        let (docs, _): (Vec<_>, _) = Document::retrieve_batch(&mut pool.get_ok(), ids.clone())
            .await
            .expect("Failed to retrieve documents");
        assert_eq!(
            docs.iter()
                .map(|d| d.content_type.clone())
                .collect::<HashSet<_>>(),
            HashSet::from([String::from("text/plain"), new_ct])
        );

        let not_deleted = ids.remove(0);
        let count = Document::delete_batch(&mut pool.get_ok(), ids)
            .await
            .expect("Failed to delete documents");
        assert_eq!(count, 4);

        let exists = Document::exists(&mut pool.get_ok(), not_deleted)
            .await
            .expect("Failed to check if document exists");

        assert!(exists);
    }

    #[rstest]
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

        #[derive(Debug, Clone, Model)]
        #[model(table = editoast_models::tables::document)]
        #[model(gen(ops = r, batch_ops = c))]
        struct Document {
            id: i64,
            content_type: String,
            #[model(remote = "Vec<u8>")]
            data: Data,
        }

        let pool = DbConnectionPoolV2::for_tests();
        let docs = Document::create_batch::<_, Vec<_>>(
            &mut pool.get_ok(),
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
        .expect("Failed to create documents")
        .into_iter()
        .collect::<Vec<_>>();
        assert_eq!(docs.len(), 2);

        let ids = docs.iter().map(|d| d.id).collect::<Vec<_>>();
        assert_eq!(
            Document::retrieve(&mut pool.get_ok(), ids[0])
                .await
                .expect("Failed to retrieve document")
                .expect("Document not found")
                .data,
            Data::Prefixed(0x43)
        );
        assert_eq!(
            Document::retrieve(&mut pool.get_ok(), ids[1])
                .await
                .expect("Failed to retrieve document")
                .expect("Document not found")
                .data,
            Data::Raw(0, 1)
        );
    }

    #[rstest]
    async fn test_list() {
        // GIVEN
        let pool = DbConnectionPoolV2::for_tests();

        let (multiple_ct, unique_ct) = ("models_test_list/multiple", "models_test_list/unique");
        let changesets = (0..20).map(|i| {
            Document::changeset()
                .content_type(multiple_ct.to_string())
                .data(vec![i])
        });
        let mut documents = Document::create_batch::<_, Vec<_>>(&mut pool.get_ok(), changesets)
            .await
            .expect("Failed to create documents batch");
        let unique_doc_idx = 10;

        documents[unique_doc_idx]
            .patch()
            .content_type(unique_ct.to_string())
            .apply(&mut pool.get_ok())
            .await
            .expect("Failed to update document");

        // WHEN
        let (list, multiple_count) = Document::list_and_count(
            &mut pool.get_ok(),
            SelectionSettings::new()
                .filter(move || Document::CONTENT_TYPE.eq(multiple_ct.to_string()))
                .order_by(|| Document::ID.desc())
                .limit(10),
        )
        .await
        .expect("Failed to list documents with multiple content type");

        let (past_unique_ct_index, unique_count) = Document::list_and_count(
            &mut pool.get_ok(),
            SelectionSettings::new()
                .filter(move || Document::CONTENT_TYPE.eq(unique_ct.to_string()))
                .offset(15),
        )
        .await
        .expect("Failed to list documents with unique content type");
        let (with_unique, unique_count_bis) = Document::list_and_count(
            &mut pool.get_ok(),
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
                .rev()
                .collect::<Vec<&Document>>()
        );
        assert_eq!(unique_count, 1);
        assert!(past_unique_ct_index.is_empty());
        assert_eq!(unique_count_bis, 1);
        assert_eq!(with_unique.len(), 1);
        assert_eq!(with_unique[0], documents[unique_doc_idx]);
    }
}
