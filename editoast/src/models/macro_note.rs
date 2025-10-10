use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_models::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq)]
#[model(table = database::tables::macro_note)]
#[model(gen(ops = crud, batch_ops = c, list))]
pub struct MacroNote {
    pub id: i64,
    pub scenario_id: i64,
    pub x: i64,
    pub y: i64,
    pub title: String,
    pub text: String,
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
}

#[cfg(test)]
pub mod test {
    use super::*;

    use database::DbConnectionPoolV2;
    use editoast_models::prelude::*;
    use pretty_assertions::assert_eq;

    use crate::models::fixtures::create_scenario_fixtures_set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_note_create_and_get() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;
        // Create note
        let created = MacroNote::changeset()
            .scenario_id(fixtures.scenario.id)
            .x(10)
            .y(12)
            .title("New note".to_string())
            .text("Note content".to_string())
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro note");

        // Retrieve the created note
        let note = MacroNote::retrieve(db_pool.get_ok(), created.id)
            .await
            .expect("Failed to retrieve note")
            .expect("Macro note not found");

        assert_eq!(&created, &note);
    }
}
