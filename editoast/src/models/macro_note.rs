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
    use editoast_models::Infra;
    use editoast_models::prelude::*;
    use editoast_models::project::Project;
    use editoast_models::scenario::Scenario;
    use editoast_models::study::Study;
    use editoast_models::timetable::Timetable;
    use pretty_assertions::assert_eq;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_note_create_and_get() {
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

        // Create note
        let created = MacroNote::changeset()
            .scenario_id(scenario.id)
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
