use std::sync::Arc;

use axum::extract::Path;
use axum::extract::State;
use axum::extract::WebSocketUpgrade;
use axum::extract::ws;
use axum::response::IntoResponse;
use database::DbConnectionPool;
use jiff::Timestamp;
use models::MacroNote;
use models::notifications::NotificationError;
use serde::Serialize;
use utoipa::ToSchema;

use crate::views::DatabaseError;
use crate::views::operational_studies::hierarchy::scenario::ScenarioIdParam;
use crate::views::operational_studies::macro_view::macro_notes::MacroNoteResponse;

#[editoast_derive::title_variants]
#[derive(Debug, Serialize, ToSchema)]
pub(in crate::views) enum ScenarioEventMessage {
    Event {
        epoch: Timestamp,
        event: ScenarioEvent,
    },
    /// A fatal error occurred while processing the event stream. The WebSocket will be closed after this message.
    FatalError,
}

#[editoast_derive::title_variants]
#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "type")]
pub(in crate::views) enum ScenarioEvent {
    MacroNoteUpserted(MacroNoteResponse),
    MacroNoteDeleted { id: i64 },
}

impl From<models::macro_note::MacroNoteNotification> for ScenarioEvent {
    fn from(notification: models::macro_note::MacroNoteNotification) -> Self {
        match notification {
            models::macro_note::MacroNoteNotification::Upserted(note) => {
                ScenarioEvent::MacroNoteUpserted(MacroNoteResponse::from(note))
            }
            models::macro_note::MacroNoteNotification::Deleted(note) => {
                ScenarioEvent::MacroNoteDeleted { id: note.id }
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
        (status = 101, body = ScenarioEventMessage, description = "WebSocket sending ScenarioEventMessage JSON messages"),
        DatabaseError,
    )
)]
pub(in crate::views) async fn events(
    State(db_pool): State<Arc<DbConnectionPool>>,
    Path(ScenarioIdParam { scenario_id }): Path<ScenarioIdParam>,
    websocket: WebSocketUpgrade,
) -> Result<impl IntoResponse, DatabaseError> {
    use futures_util::TryStreamExt as _;

    let conn = db_pool.get().await?;

    Ok(websocket.on_upgrade(move |mut socket| async move {
        use futures_util::StreamExt as _;
        let fatal_error = || {
            ws::Message::text(
                serde_json::to_string(&ScenarioEventMessage::FatalError)
                    .expect("unit variant should serialize properly"),
            )
        };

        let mut conn = conn.write().await;
        let events = match MacroNote::notifications(&mut conn).await {
            Ok(stream) => stream.into_stream(),
            Err(err) => {
                tracing::error!(%err, "could not open event stream");
                if let Err(send_error) = socket.send(fatal_error()).await {
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
                    let models::notifications::Notification { epoch, notification } = match event {
                        None => break 'socket_loop, // event stream closed
                        Some(Ok(event)) => event,
                        Some(Err(error @ NotificationError::Database(_))) => {
                            tracing::error!(%error, "database error while listening to scenario events — exiting");
                            if let Err(send_error) = socket.send(fatal_error()).await {
                                tracing::warn!(%send_error, "failed to send fatal error message over WebSocket — closing anyway");
                                break 'socket_loop;
                            }
                            break 'socket_loop;
                        }
                        Some(Err(error @ (NotificationError::MalformedNotification(_) | NotificationError::UnexpectedNotification { .. }))) => {
                            tracing::error!(%error, "ignoring invalid or unexpected notification");
                            continue 'socket_loop;
                        }
                    };

                    if notification.note().scenario_id == scenario_id {
                        let message = ScenarioEventMessage::Event {
                            epoch,
                            event: ScenarioEvent::from(notification),
                        };
                        let Ok(json) = serde_json::to_string(&message) else {
                            tracing::error!(?message, "failed to serialize scenario event message — ignoring");
                            continue 'socket_loop;
                        };
                        if let Err(error) = socket.send(ws::Message::text(json)).await {
                            tracing::warn!(%error, ?message, "failed to send scenario event message over WebSocket — continuing");
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
