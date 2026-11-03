use std::sync::Arc;

use axum::extract::Path;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::extract::ws;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use database::DbConnectionPool;
use models::MacroNote;
use models::history::HistoryError;
use serde::Serialize;
use utoipa::ToSchema;

use crate::views::DatabaseError;
use crate::views::operational_studies::hierarchy::scenario::ScenarioIdParam;
use crate::views::operational_studies::macro_view::macro_notes::MacroNoteResponse;

#[editoast_derive::title_variants]
#[derive(Debug, Serialize, ToSchema)]
pub(in crate::views) enum HistoryEventMessage {
    Event {
        epoch: DateTime<Utc>,
        event: HistoryEvent,
    },
    /// A fatal error occurred while processing the event stream. The WebSocket will be closed after this message.
    FatalError,
}

#[editoast_derive::title_variants]
#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "type")]
pub(in crate::views) enum HistoryEvent {
    MacroNoteUpserted(MacroNoteResponse),
    MacroNoteDeleted { id: i64 },
}

impl From<models::macro_note::MacroNoteEvent> for HistoryEvent {
    fn from(event: models::macro_note::MacroNoteEvent) -> Self {
        match event {
            models::macro_note::MacroNoteEvent::Upserted(note) => {
                HistoryEvent::MacroNoteUpserted(MacroNoteResponse::from(note))
            }
            models::macro_note::MacroNoteEvent::Deleted(note) => {
                HistoryEvent::MacroNoteDeleted { id: note.id }
            }
        }
    }
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ScenarioIdParam),
    responses(
        (status = 101, body = HistoryEventMessage, description = "WebSocket sending LiveUpdateMessage JSON messages"),
        DatabaseError,
    )
)]
pub(in crate::views) async fn history_events(
    State(db_pool): State<Arc<DbConnectionPool>>,
    Path(ScenarioIdParam { scenario_id }): Path<ScenarioIdParam>,
    websocket: WebSocketUpgrade,
) -> Result<impl IntoResponse, DatabaseError> {
    use futures_util::TryStreamExt as _;

    let conn = db_pool.get().await?;

    Ok(websocket.on_upgrade(move |mut socket| async move {
        use futures_util::StreamExt as _;
        let fatal_error = serde_json::to_string(&HistoryEventMessage::FatalError).expect("unit variant should serialize properly");

        let mut conn = conn.write().await;
        let events = match MacroNote::event_stream(&mut conn).await {
            Ok(stream) => stream.into_stream(),
            Err(err) => {
                tracing::error!(%err, "could not open event stream");
                if let Err(send_error) = socket.send(ws::Message::text(&fatal_error)).await {
                    tracing::warn!(%send_error, "failed to send fatal error message over WebSocket — closing anyway");
                    return;
                }
                return;
            }
        };
        tokio::pin!(events);

        'socket_loop: loop {
            tokio::select! {
                event = events.next() => {
                    let models::history::HistoryEvent { epoch, event } = match event {
                        None => break 'socket_loop, // event stream closed
                        Some(Ok(event)) => event,
                        Some(Err(error @ HistoryError::Database(_))) => {
                            tracing::error!(%error, "database error while listening to history events — exiting");
                            if let Err(send_error) = socket.send(ws::Message::text(&fatal_error)).await {
                                tracing::warn!(%send_error, "failed to send fatal error message over WebSocket — closing anyway");
                                break 'socket_loop;
                            }
                            break 'socket_loop;
                        }
                        Some(Err(error @ (HistoryError::MalformedEvent(_) | HistoryError::UnexpectedEvent { .. }))) => {
                            tracing::error!(%error, "ignoring invalid or unexpected history event");
                            continue 'socket_loop;
                        }
                    };

                    if event.note().scenario_id == scenario_id {
                        let message = HistoryEventMessage::Event {
                            epoch,
                            event: HistoryEvent::from(event),
                        };
                        let Ok(json) = serde_json::to_string(&message) else {
                            tracing::error!(?message, "failed to serialize history event message — ignoring");
                            continue 'socket_loop;
                        };
                        if let Err(error) = socket.send(ws::Message::text(json)).await {
                            tracing::warn!(%error, ?message, "failed to send history event message over WebSocket — continuing");
                            continue 'socket_loop;
                        }
                    }
                }
                message = socket.recv() => {
                    match message {
                        Some(Ok(ws::Message::Close(_))) | None => break 'socket_loop,
                        Some(Err(error)) => {
                            tracing::warn!(%error, "error while receiving message from WebSocket — ignoring");
                            continue 'socket_loop;
                        },
                        Some(Ok(_)) => {}
                    }
                }
            }
        }
    }))
}
