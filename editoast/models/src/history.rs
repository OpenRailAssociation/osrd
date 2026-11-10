use chrono::DateTime;
use chrono::Utc;
use diesel::pg::PgNotification;
use futures::TryStream;
use serde::Deserialize;

/// An object modification event raised by PostgreSQL on select editoast objects.
///
/// The event type `T` should deserialize as `{ "type": "<event_type>", "object": { ... } }`.
/// Tip: use `#[serde(tag = "type", content = "object")]` on the event enum to achieve this.
#[derive(Debug, Deserialize)]
pub struct HistoryEvent<T>
where
    T: std::fmt::Debug + serde::de::DeserializeOwned,
{
    pub epoch: DateTime<Utc>,
    #[serde(flatten, bound(deserialize = "T: serde::de::DeserializeOwned"))] // needed on stable but not on nightly ¯\_(ツ)_/¯
    pub event: T,
}

#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    #[error(transparent)]
    Database(#[from] database::DatabaseError),
    #[error(transparent)]
    MalformedEvent(#[from] serde_json::Error),
    #[error("unexpected event with type {} on channel {channel}", r#type)]
    UnexpectedEvent {
        r#type: String,
        channel: String,
        payload: String,
    },
}

/// Produces a stream of events parsed from notification on the given PostgreSQL channel.
pub(crate) async fn history_stream<T>(
    conn: &mut diesel_async::AsyncPgConnection,
    channel: &'static str,
) -> Result<impl TryStream<Ok = HistoryEvent<T>, Error = HistoryError>, database::DatabaseError>
where
    T: std::fmt::Debug + serde::de::DeserializeOwned,
{
    use diesel_async::RunQueryDsl as _;
    use futures::StreamExt as _;

    diesel::sql_query(format!("LISTEN {channel}"))
        .execute(conn)
        .await?;

    Ok(conn
        .notifications_stream()
        .map(|notif| match notif {
            Err(e) => Err(HistoryError::Database(e.into())),
            Ok(PgNotification {
                channel,
                payload,
                process_id: _,
            }) => {
                let Ok(event) = serde_json::from_str::<HistoryEvent<T>>(&payload) else {
                    #[derive(Deserialize)]
                    struct EventType {
                        r#type: String,
                    }

                    let EventType { r#type } = serde_json::from_str::<EventType>(&payload)?;
                    return Err(HistoryError::UnexpectedEvent {
                        r#type,
                        channel,
                        payload,
                    });
                };
                Ok(event)
            }
        })
        .boxed())
}
