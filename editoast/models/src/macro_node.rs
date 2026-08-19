use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, DeriveEntityModel, ToSchema, PartialEq)]
#[sea_orm(table_name = "macro_node")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "macro_node_scenario_id_path_item_key_key")]
    pub scenario_id: i64,
    pub position_x: i64,
    pub position_y: i64,
    pub full_name: Option<String>,
    pub labels: Tags,
    pub trigram: Option<String>,
    #[sea_orm(unique_key = "macro_node_scenario_id_path_item_key_key")]
    pub path_item_key: String,
    pub is_collapsed: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::scenario::Entity",
        from = "Column::ScenarioId",
        to = "super::scenario::Column::Id",
        on_delete = "Cascade"
    )]
    Scenario,
}

impl Related<super::scenario::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Scenario.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[cfg(test)]
pub mod test {
    use super::*;

    use crate::infra;
    use crate::macro_node;
    use crate::project;
    use crate::scenario;
    use crate::study;
    use crate::timetable;
    use database::Db;
    use pretty_assertions::assert_eq;
    use sea_orm::Set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_node_create_and_get() {
        let db = Db::for_tests().await;
        let infra = infra::ActiveModel {
            name: Set("empty_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .insert(&db)
        .await
        .expect("Failed to create empty infra");

        let timetable = <timetable::ActiveModel as Default>::default()
            .insert(&db)
            .await
            .expect("Failed to create timetable");

        let project = project::ActiveModel::fake("test_project")
            .insert(&db)
            .await
            .expect("Failed to create project");
        let study = study::ActiveModel::fake("test_study", project.id)
            .insert(&db)
            .await
            .expect("Failed to create study");
        let scenario =
            scenario::ActiveModel::fake("test_scenario_name", study.id, infra.id, timetable.id)
                .insert(&db)
                .await
                .expect("Failed to create scenario");

        // Create node
        let created = macro_node::ActiveModel {
            scenario_id: Set(scenario.id),
            position_x: Set(12),
            position_y: Set(32),
            full_name: Set(Some("My Super Node".to_string())),
            labels: Set(Tags::new(vec!["A".to_string(), "B".to_string()])),
            trigram: Set(Some("ABC".to_string())),
            path_item_key: Set("PATH".to_string()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create macro node");

        // Retrieve the created node
        let node = Entity::find_by_id(created.id)
            .one(&db)
            .await
            .expect("Failed to retrieve node")
            .expect("Macro node not found");

        assert_eq!(&created, &node);
    }
}
