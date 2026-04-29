use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::tags::Tags;

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
    pub is_collapsed: bool,
}

#[cfg(test)]
pub mod test {
    use super::*;

    use crate::Infra;
    use crate::prelude::*;
    use crate::project::Project;
    use crate::scenario::Scenario;
    use crate::study::Study;
    use crate::timetable::Timetable;
    use database::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_node_create_and_get() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = Infra::changeset()
            .name("empty_infra".to_owned())
            .last_railjson_version()
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create empty infra");

        let timetable = Timetable::changeset()
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create timetable");

        let project = Project::fake("test_project")
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create project");
        let study = Study::fake("test_study", project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");
        let scenario = Scenario::fake("test_scenario_name", study.id, infra.id, timetable.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create scenario");

        // Create node
        let created = MacroNode::changeset()
            .scenario_id(scenario.id)
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
