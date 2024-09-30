use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[allow(unused_imports)]
use crate::models::prelude::*;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq)]
#[model(table = editoast_models::tables::macro_node)]
#[model(gen(ops = crud, list))]
pub struct MacroNode {
    pub id: i64,
    pub scenario_id: i64,
    pub position_x: f64,
    pub position_y: f64,
    pub full_name: Option<String>,
    pub connection_time: i64,
    pub labels: Vec<Option<String>>,
    pub trigram: Option<String>,
    pub path_item_key: String,
}

impl MacroNode {}

#[cfg(test)]
pub mod test {
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::{models::fixtures::create_scenario_fixtures_set, Model};
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn macro_node_create_and_get() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        // Create node
        let created = MacroNode::changeset()
            .scenario_id(fixtures.scenario.id)
            .position_x(12.0)
            .position_y(32.0)
            .full_name(Some("My Super Node".to_string()))
            .connection_time(51)
            .labels(vec![Some("A".to_string()), Some("B".to_string())])
            .trigram(Some("ABC".to_string()))
            .path_item_key("PATH".to_string())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro node");

        // Retrieve the created node
        let node = MacroNode::retrieve(&mut db_pool.get_ok(), created.id)
            .await
            .expect("Failed to retrieve node")
            .expect("Macro node not found");

        assert_eq!(&created, &node);
    }
}
