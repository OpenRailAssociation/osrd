use editoast_derive::EditoastError;
use futures_util::StreamExt;
use itertools::Itertools;
use lapin::{
    options::{BasicConsumeOptions, BasicPublishOptions},
    types::{ByteArray, FieldTable, ShortString},
    BasicProperties, Connection, ConnectionProperties,
};
use serde::Serialize;
use serde_json::to_vec;
use std::{fmt::Debug, sync::Arc};
use thiserror::Error;
use tokio::time::{timeout, Duration};

#[derive(Debug, Clone)]
pub struct RabbitMQClient {
    connection: Arc<Connection>,
    exchange: String,
    timeout: u64,
    hostname: String,
}

pub struct Options {
    /// format `amqp://username:password@host:port/vhost`
    /// for instance: `amqp://osrd:password@localhost:5672/%2f` for the default vhost
    pub uri: String,
    /// Exchange name
    pub worker_pool_identifier: String,
    /// Default timeout for the response
    pub timeout: u64,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "coreclient")]
pub enum Error {
    #[error("AMQP error: {0}")]
    #[editoast_error(status = "500")]
    Lapin(#[from] lapin::Error),
    #[error("Cannot serialize request: {0}")]
    #[editoast_error(status = "500")]
    Serialization(serde_json::Error),
    #[error("Cannot parse response status")]
    #[editoast_error(status = "500")]
    StatusParsing,
    #[error("Response timeout")]
    #[editoast_error(status = "500")]
    ResponseTimeout,
}

pub struct MQResponse {
    pub payload: Vec<u8>,
    pub status: Vec<u8>,
}

impl RabbitMQClient {
    pub async fn new(options: Options) -> Result<Self, Error> {
        let connection = Connection::connect(&options.uri, ConnectionProperties::default())
            .await
            .map_err(Error::Lapin)?;
        let hostname = hostname::get()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "unknown".to_string());

        Ok(RabbitMQClient {
            connection: Arc::new(connection),
            exchange: format!("{}-req-xchg", options.worker_pool_identifier),
            timeout: options.timeout,
            hostname,
        })
    }

    #[allow(dead_code)]
    pub async fn call<T>(
        &self,
        routing_key: String,
        path: &str,
        published_payload: &T,
        mandatory: bool,
        correlation_id: Option<String>,
    ) -> Result<(), Error>
    where
        T: Serialize,
    {
        // Create a channel
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(Error::Lapin)?;

        let serialized_payload_vec = to_vec(published_payload).map_err(Error::Serialization)?;
        let serialized_payload = serialized_payload_vec.as_slice();

        let options = BasicPublishOptions {
            mandatory,
            ..Default::default()
        };

        let path: ByteArray = path.bytes().collect_vec().into();
        let mut headers = FieldTable::default();
        headers.insert("x-rpc-path".into(), path.into());
        attach_tracing_info(&mut headers);

        let mut properties = BasicProperties::default().with_headers(headers);
        if let Some(id) = correlation_id {
            properties = properties.with_correlation_id(ShortString::from(id));
        }

        let properties = properties;

        channel
            .basic_publish(
                self.exchange.as_str(),
                routing_key.as_str(),
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(Error::Lapin)?;

        Ok(())
    }

    pub async fn call_with_response<T>(
        &self,
        routing_key: String,
        path: &str,
        published_payload: &Option<T>,
        mandatory: bool,
        override_timeout: Option<u64>,
    ) -> Result<MQResponse, Error>
    where
        T: Serialize,
    {
        // Create a channel
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(Error::Lapin)?;

        let serialized_payload_vec = to_vec(published_payload).map_err(Error::Serialization)?;
        let serialized_payload = serialized_payload_vec.as_slice();

        let options = BasicPublishOptions {
            mandatory,
            ..Default::default()
        };

        let path: ByteArray = path.bytes().collect_vec().into();
        let mut headers = FieldTable::default();
        headers.insert("x-rpc-path".into(), path.into());
        attach_tracing_info(&mut headers);

        let properties = BasicProperties::default()
            .with_reply_to(ShortString::from("amq.rabbitmq.reply-to"))
            .with_headers(headers);

        // Set up a consumer on the reply-to queue
        let mut consumer = channel
            .basic_consume(
                "amq.rabbitmq.reply-to",
                self.hostname.as_str(),
                BasicConsumeOptions {
                    no_ack: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .map_err(Error::Lapin)?;

        // Publish the message
        channel
            .basic_publish(
                self.exchange.as_str(),
                routing_key.as_str(),
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(Error::Lapin)?;

        // Await the response
        let response_delivery = timeout(
            Duration::from_secs(override_timeout.unwrap_or(self.timeout)),
            consumer.next(),
        )
        .await
        .map_err(|_| Error::ResponseTimeout)?;

        if let Some(Ok(delivery)) = response_delivery {
            let status = delivery
                .properties
                .headers()
                .as_ref()
                .and_then(|f| f.inner().get("x-status"))
                .and_then(|s| s.as_byte_array())
                .map(|s| Ok(s.as_slice().to_owned()))
                .unwrap_or(Err(Error::StatusParsing))?;

            Ok(MQResponse {
                payload: delivery.data,
                status,
            })
        } else {
            Err(Error::ResponseTimeout)
        }
    }
}

fn attach_tracing_info(headers: &mut FieldTable) {
    use opentelemetry::global as otel;
    use tracing::Span;
    use tracing_opentelemetry::OpenTelemetrySpanExt;
    let ctx = Span::current().context();

    otel::get_text_map_propagator(|propagator| {
        propagator.inject_context(&ctx, &mut HeaderInjector(headers));
    });
}

struct HeaderInjector<'a>(&'a mut FieldTable);
impl opentelemetry::propagation::Injector for HeaderInjector<'_> {
    /// Set a key and value pair on the headers
    fn set(&mut self, key: &str, value: String) {
        let value: ByteArray = value.bytes().collect_vec().into();
        self.0.insert(key.into(), value.into());
    }
}