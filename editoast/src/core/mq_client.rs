use futures_util::StreamExt;
use lapin::{
    options::{BasicPublishOptions, QueueDeclareOptions},
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties,
};
use serde::{Deserialize, Serialize};
use serde_json::to_vec;
use std::fmt::Debug;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

pub struct RabbitMQClient {
    connection: Connection,
    core_queue_prefix: String,
    exchange: String,
    timeout: u64,
}

pub struct Options {
    /// format `amqp://username:password@host:port/vhost`
    /// for instance: `amqp://osrd:password@localhost:5672/%2f` for the default vhost
    pub uri: String,
    /// Exchange name
    pub exchange: String,
    /// Prefix for the core queues
    pub core_queue_prefix: String,
    /// Default timeout for the response
    pub timeout: u64,
}

#[derive(Serialize, Deserialize, Debug)]
struct MessageEnvelope<T>
where
    T: Serialize + Debug,
{
    payload: T,
    message_type: String,
    respond_to: Option<String>,
    infra_expected_version: i64,
}

impl<T> MessageEnvelope<T>
where
    T: Serialize + Debug,
{
    fn new(
        payload: T,
        message_type: String,
        respond_to: Option<String>,
        infra_expected_version: i64,
    ) -> Self {
        MessageEnvelope {
            payload,
            message_type,
            respond_to,
            infra_expected_version,
        }
    }

    fn serialized_payload(&self) -> Result<Vec<u8>, Error> {
        Ok(to_vec(&self).map_err(Error::SerializationError)?)
    }
}

#[derive(Debug)]
pub enum Error {
    Lapin(lapin::Error),
    SerializationError(serde_json::Error),
    ResponseTimeout,
}

impl RabbitMQClient {
    pub async fn new(options: Options) -> Result<Self, lapin::Error> {
        let connection = Connection::connect(&options.uri, ConnectionProperties::default()).await?;
        Ok(RabbitMQClient {
            connection,
            core_queue_prefix: options.core_queue_prefix,
            exchange: options.exchange,
            timeout: options.timeout,
        })
    }

    /// Create the core queue.
    /// If it does not exist, the queue will be created with the provided options.
    /// If it exists, the queue_declare call will not have any effect.
    pub async fn create_queue_for_core(
        &self,
        channel: &Channel,
        infra_id: i64,
    ) -> Result<String, Error> {
        let core_queue_name = format!("{}-{}", self.core_queue_prefix, infra_id);

        channel
            .queue_declare(
                &core_queue_name,
                QueueDeclareOptions {
                    exclusive: false,
                    auto_delete: false,
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        Ok(core_queue_name)
    }

    pub async fn call<T>(
        &self,
        message_type: &str,
        infra_id: i64,
        infra_expected_version: i64,
        payload: T,
    ) -> Result<(), Error>
    where
        T: Serialize + Debug,
    {
        // Create a channel
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(Error::Lapin)?;

        // Prepare the message
        let serialized_payload = MessageEnvelope::new(
            payload,
            message_type.to_string(),
            None,
            infra_expected_version,
        )
        .serialized_payload()?;

        // Prepare the queue and publish the message to the core queue
        let core_queue_name = self.create_queue_for_core(&channel, infra_id).await?;
        channel
            .basic_publish(
                &self.exchange,
                core_queue_name.as_str(),
                BasicPublishOptions::default(),
                &serialized_payload,
                BasicProperties::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        Ok(())
    }

    pub async fn call_with_response<T, TR>(
        &self,
        message_type: &str,
        infra_id: i64,
        infra_expected_version: i64,
        payload: T,
        override_timeout: Option<u64>,
    ) -> Result<TR, Error>
    where
        T: Serialize + Debug,
        TR: for<'de> Deserialize<'de> + Debug,
    {
        // Create a channel
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(Error::Lapin)?;

        // Declare a queue with a random name for the response.
        // This queue will be deleted after the response is received.
        let temp_queue_name = format!("resp-{}", Uuid::new_v4());
        let temp_queue = channel
            .queue_declare(
                &temp_queue_name,
                QueueDeclareOptions {
                    exclusive: true,
                    auto_delete: true,
                    durable: false,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        // Prepare the message
        let serialized_payload = MessageEnvelope::new(
            payload,
            message_type.to_string(),
            Some(temp_queue_name),
            infra_expected_version,
        )
        .serialized_payload()?;

        let core_queue_name = self.create_queue_for_core(&channel, infra_id).await?;

        // Publish the message to the core queue
        channel
            .basic_publish(
                &self.exchange,
                core_queue_name.as_str(),
                BasicPublishOptions::default(),
                &serialized_payload,
                BasicProperties::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        // Create a consumer for the temporary response queue
        let consumer = channel
            .basic_consume(
                &temp_queue.name().as_str(),
                "editoast",
                lapin::options::BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        // Wait for the response, resolve it and return it
        let timeout_duration = override_timeout.unwrap_or(self.timeout);
        let message = timeout(
            Duration::from_secs(timeout_duration),
            consumer.into_future(),
        )
        .await
        .map_err(|_| Error::ResponseTimeout)?
        .0
        .unwrap()
        .map_err(Error::Lapin)?;
        Ok(serde_json::from_slice(&message.data).map_err(Error::SerializationError)?)
    }
}
