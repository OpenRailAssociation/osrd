use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_models::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq)]
#[model(table = database::tables::macro_node)]
#[model(gen(ops = crud, batch_ops = c, list))]
pub struct MacroNode {
    pub id: i64,
    pub scenario_id: i64,
    pub position_x: i64,
    pub position_y: i64,
    pub full_name: Option<String>,
    pub connection_time: i64,
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
    pub trigram: Option<String>,
    pub path_item_key: String,
}

#[cfg(test)]
pub mod test {
    use super::*;

    use database::DbConnectionPoolV2;
    use editoast_models::prelude::*;
    use pretty_assertions::assert_eq;

    use crate::models::fixtures::create_scenario_fixtures_set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_node_create_and_get() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        // Create node
        let created = MacroNode::changeset()
            .scenario_id(fixtures.scenario.id)
            .position_x(12)
            .position_y(32)
            .full_name(Some("My Super Node".to_string()))
            .connection_time(51)
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .trigram(Some("ABC".to_string()))
            .path_item_key("PATH".to_string())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro node");

        // Retrieve the created node
        let node = MacroNode::retrieve(db_pool.get_ok(), created.id)
            .await
            .expect("Failed to retrieve node")
            .expect("Macro node not found");

        assert_eq!(&created, &node);
    }
}
