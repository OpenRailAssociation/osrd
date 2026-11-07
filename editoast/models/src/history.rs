use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;

use crate::macro_note::MacroNote;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct HistoryNotification {
    pub epoch: DateTime<Utc>,
    pub r#type: HistoryEvent,
    pub object: MacroNote,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub enum HistoryEvent {
    MacroNoteUpserted,
    MacroNoteDeleted,
}
