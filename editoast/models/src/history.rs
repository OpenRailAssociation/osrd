use diesel::pg::PgNotification;
use futures::TryStream;
use jiff::Timestamp;
use serde::Deserialize;

pub trait NotificationMessage: std::fmt::Debug + serde::de::DeserializeOwned {}

/// An object modification notification raised by PostgreSQL on select editoast objects.
///
/// The notification type `T` should deserialize as `{ "type": "<notification_type>", "object": { ... } }`.
/// Tip: use `#[serde(tag = "type", content = "object")]` on the notification enum to achieve this.
#[derive(Debug, Deserialize)]
pub struct Notification<T>
where
    T: NotificationMessage,
{
    pub epoch: Timestamp,
    #[serde(flatten, bound(deserialize = "T: serde::de::DeserializeOwned"))]
    // needed until the new trait solver lands on stable
    pub notification: T,
}

#[derive(Debug, thiserror::Error)]
pub enum NotificationError {
    #[error(transparent)]
    Database(#[from] database::DatabaseError),
    #[error(transparent)]
    MalformedNotification(#[from] serde_json::Error),
    #[error(
        "unexpected notification with type ‘{}’ on channel ‘{channel}’",
        r#type
    )]
    UnexpectedNotification {
        r#type: String,
        channel: String,
        payload: String,
    },
}

/// Produces a stream of parsed notifications from the given PostgreSQL channel.
pub(crate) async fn notifications<T>(
    conn: &mut diesel_async::AsyncPgConnection,
    channel: &'static str,
) -> Result<impl TryStream<Ok = Notification<T>, Error = NotificationError>, database::DatabaseError>
where
    T: NotificationMessage,
{
    use diesel_async::RunQueryDsl as _;
    use futures::StreamExt as _;

    diesel::sql_query(format!("LISTEN {channel}"))
        .execute(conn)
        .await?;

    Ok(conn
        .notifications_stream()
        .map(move |notif| match notif {
            Err(e) => Err(NotificationError::Database(e.into())),
            Ok(PgNotification {
                channel: chan,
                payload,
                process_id: _,
            }) => {
                debug_assert_eq!(&chan, channel);
                let Ok(notification) = serde_json::from_str::<Notification<T>>(&payload) else {
                    #[derive(Deserialize)]
                    struct NotificationType {
                        r#type: String,
                    }

                    let NotificationType { r#type } =
                        serde_json::from_str::<NotificationType>(&payload)?;
                    return Err(NotificationError::UnexpectedNotification {
                        r#type,
                        channel: chan,
                        payload,
                    });
                };
                Ok(notification)
            }
        })
        .boxed())
}
