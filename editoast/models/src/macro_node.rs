use editoast_derive::Model;
use schemas::infra::TrackOffset;
use schemas::train_schedule::OperationalPointReference;
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
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
    pub short_name: Option<String>,
    #[model(json)]
    pub node_location: OperationalPointReferenceNode,
    pub is_collapsed: bool,
}

/// The location represented by a macro node
#[derive(Clone, Debug, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OperationalPointReferenceNode {
    #[schema(title = "OperationalPointReferenceNodeTrackOffset")]
    TrackOffset(TrackOffset),
    #[schema(title = "OperationalPointReferenceNodeOperationalPoint")]
    OperationalPoint(OperationalPointReference),
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
    use serde_json::json;

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
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .short_name(Some("ABC".to_string()))
            .node_location(OperationalPointReferenceNode::TrackOffset(
                TrackOffset::new("track", 42),
            ))
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

    #[test]
    fn node_location_json_roundtrip() {
        let locations = [
            json!({"track_offset": {"track": "TA0", "offset": 1500}}),
            json!({"operational_point": {"type": "id", "operational_point": "abc-123"}}),
            json!({"operational_point": {
                "type": "domestic", "country_code": "FR", "main_code": "PNO", "secondary_code": null
            }}),
            json!({"operational_point": {"type": "uic", "uic": 87686006, "secondary_code": "BV"}}),
        ];
        for location in locations {
            let node_location: OperationalPointReferenceNode =
                serde_json::from_value(location.clone()).expect("Invalid node location");
            assert_eq!(serde_json::to_value(node_location).unwrap(), location);
        }
    }
}
