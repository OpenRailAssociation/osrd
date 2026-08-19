use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, DeriveEntityModel, ToSchema, PartialEq)]
#[sea_orm(table_name = "macro_note")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub scenario_id: i64,
    pub x: i64,
    pub y: i64,
    pub title: String,
    pub text: String,
    pub labels: Tags,
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
    use crate::macro_note;
    use crate::project;
    use crate::scenario;
    use crate::study;
    use crate::timetable;
    use database::Db;
    use pretty_assertions::assert_eq;
    use sea_orm::Set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_note_create_and_get() {
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

        // Create note
        let created = macro_note::ActiveModel {
            scenario_id: Set(scenario.id),
            x: Set(10),
            y: Set(12),
            title: Set("New note".to_string()),
            text: Set("Note content".to_string()),
            labels: Set(Tags::new(vec!["A".to_string(), "B".to_string()])),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create macro note");

        // Retrieve the created note
        let note = Entity::find_by_id(created.id)
            .one(&db)
            .await
            .expect("Failed to retrieve note")
            .expect("Macro note not found");

        assert_eq!(&created, &note);
    }
}
