use editoast_derive::Model;
use futures::TryStream;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::history::HistoryError;
use crate::history::HistoryEvent;
use crate::tags::Tags;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq, Eq)]
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

#[derive(Debug, Deserialize)]
#[cfg_attr(test, derive(PartialEq, Eq))]
#[serde(tag = "type", content = "object")]
pub enum MacroNoteEvent {
    #[serde(rename = "MacroNoteUpserted")]
    Upserted(MacroNote),
    #[serde(rename = "MacroNoteDeleted")]
    Deleted(MacroNote),
}

impl MacroNote {
    // WARNING: We should not leak AsyncPgConnection here. But we need to own it earlier to return a stream.
    //          Hoperfully temporary until the SeaORM migration. Do not do that for non-stream returning functions.
    pub async fn event_stream(
        conn: &mut diesel_async::AsyncPgConnection,
    ) -> Result<
        impl TryStream<Ok = HistoryEvent<MacroNoteEvent>, Error = HistoryError>,
        database::DatabaseError,
    > {
        crate::history::history_stream(conn, "macro_note").await
    }
}

impl MacroNoteEvent {
    pub fn note(&self) -> &MacroNote {
        match self {
            MacroNoteEvent::Upserted(note) => note,
            MacroNoteEvent::Deleted(note) => note,
        }
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    use crate::Infra;
    use crate::prelude::*;
    use crate::project::Project;
    use crate::scenario::Scenario;
    use crate::study::Study;
    use database::DbConnectionPool;
    use pretty_assertions::assert_eq;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_note_create_and_get() {
        let db_pool = DbConnectionPool::for_tests();
        let infra = Infra::changeset()
            .name("empty_infra".to_owned())
            .last_railjson_version()
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create empty infra");

        let project = Project::fake("test_project")
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create project");
        let study = Study::fake("test_study", project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");
        let scenario = Scenario::fake("test_scenario_name", study.id, infra.id)
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn macro_note_history_notifications() {
        let db_pool = DbConnectionPool::new_test("macro_note_history_notifications".to_owned(), 2)
            .await
            .unwrap();

        // Boring setup
        let infra = Infra::changeset()
            .name("empty_infra".to_owned())
            .last_railjson_version()
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create empty infra");

        let project = Project::fake("test_project")
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create project");
        let study = Study::fake("test_study", project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");
        let scenario = Scenario::fake("test_scenario_name", study.id, infra.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create scenario");

        // Setup notification stream
        let conn = db_pool.get_ok();
        let mut conn = conn.write().await;
        let events = MacroNote::event_stream(&mut conn).await.unwrap();

        // Interact with notes
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

        let mut updated = created.clone();
        updated.title = "My super note".to_string();
        updated
            .save(&mut db_pool.get_ok())
            .await
            .expect("Failed to update macro note");

        updated
            .delete(&mut db_pool.get_ok())
            .await
            .expect("Failed to delete macro note");

        // Check the event stream
        use futures::StreamExt as _;
        use futures::TryStreamExt as _;
        let events = events
            .map_ok(|HistoryEvent { epoch: _, event }| event)
            .take(3)
            .try_collect::<Vec<_>>()
            .await
            .expect("Expected notification for macro_note creation");
        assert_eq!(
            &events,
            &[
                MacroNoteEvent::Upserted(created.clone()),
                MacroNoteEvent::Upserted(updated.clone()),
                MacroNoteEvent::Deleted(updated),
            ]
        );
    }
}
