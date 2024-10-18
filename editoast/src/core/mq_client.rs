use deadpool::managed::{Manager, Metrics, Pool, RecycleError, RecycleResult};
use editoast_derive::EditoastError;
use futures_util::StreamExt;
use itertools::Itertools;
use lapin::{
    message::Delivery,
    options::{BasicConsumeOptions, BasicPublishOptions},
    types::{ByteArray, FieldTable, ShortString},
    BasicProperties, Channel, Connection, ConnectionProperties,
};
use serde::Serialize;
use serde_json::to_vec;
use std::{collections::HashMap, fmt::Debug, sync::Arc};
use thiserror::Error;
use tokio::{
    sync::{oneshot, RwLock},
    task,
    time::{timeout, Duration},
};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct RabbitMQClient {
    pool: Pool<ChannelManager>,
    exchange: String,
    timeout: u64,
    single_worker: bool,
}

#[derive(Debug, Clone)]
pub struct ChannelManager {
    connection: Arc<RwLock<Option<Connection>>>,
    hostname: String,
}

impl ChannelManager {
    pub fn new(connection: Arc<RwLock<Option<Connection>>>, hostname: String) -> Self {
        ChannelManager {
            connection,
            hostname,
        }
    }
}

pub enum ChannelManagerError {
    Lapin,
    ConnectionNotFound,
    BadChannelState,
}

impl Manager for ChannelManager {
    type Type = ChannelWorker;
    type Error = ChannelManagerError;

    async fn create(&self) -> Result<ChannelWorker, ChannelManagerError> {
        let connection = self.connection.read().await;
        if let Some(connection) = connection.as_ref() {
            let channel = connection
                .create_channel()
                .await
                .map_err(|_| ChannelManagerError::Lapin)?;

            Ok(ChannelWorker::new(Arc::new(channel), self.hostname.clone()).await)
        } else {
            Err(ChannelManagerError::ConnectionNotFound)
        }
    }

    async fn recycle(
        &self,
        cw: &mut ChannelWorker,
        _: &Metrics,
    ) -> RecycleResult<ChannelManagerError> {
        if cw.should_reuse() {
            Ok(())
        } else {
            Err(RecycleError::Backend(ChannelManagerError::BadChannelState))
        }
    }
}

#[derive(Debug)]
pub struct ChannelWorker {
    channel: Arc<Channel>,
    response_tracker: Arc<RwLock<HashMap<String, oneshot::Sender<Delivery>>>>,
    consumer_tag: String,
}

impl ChannelWorker {
    pub async fn new(channel: Arc<Channel>, hostname: String) -> Self {
        let worker = ChannelWorker {
            channel,
            response_tracker: Arc::new(RwLock::new(HashMap::new())),
            consumer_tag: format!("{}-{}", hostname, Uuid::new_v4()),
        };
        worker.dispatching_loop().await;
        worker
    }

    pub fn get_channel(&self) -> Arc<Channel> {
        self.channel.clone()
    }

    pub async fn register_response_tracker(
        &self,
        correlation_id: String,
        tx: oneshot::Sender<Delivery>,
    ) {
        let mut response_tracker = self.response_tracker.write().await;
        response_tracker.insert(correlation_id, tx);
    }

    pub fn should_reuse(&self) -> bool {
        self.channel.status().state() == lapin::ChannelState::Connected
    }

    async fn dispatching_loop(&self) {
        let channel = self.channel.clone();
        let response_tracker = self.response_tracker.clone();
        let consumer_tag = self.consumer_tag.clone();

        let mut consumer = channel
            .basic_consume(
                "amq.rabbitmq.reply-to",
                consumer_tag.as_str(),
                BasicConsumeOptions {
                    no_ack: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .expect("Failed to consume from reply-to queue");

        task::spawn(async move {
            while let Some(delivery) = consumer.next().await {
                let delivery = delivery.expect("Error in receiving message");
                if let Some(correlation_id) = delivery.properties.correlation_id().as_ref() {
                    let mut tracker = response_tracker.write().await;
                    if let Some(sender) = tracker.remove(correlation_id.as_str()) {
                        let _ = sender.send(delivery);
                    }
                } else {
                    tracing::error!("Received message without correlation_id");
                }
            }
        });
    }
}

pub struct Options {
    /// format `amqp://username:password@host:port/vhost`
    /// for instance: `amqp://osrd:password@localhost:5672/%2f` for the default vhost
    pub uri: String,
    /// Exchange name
    pub worker_pool_identifier: String,
    /// Default timeout for the response
    pub timeout: u64,
    pub single_worker: bool,
    pub num_channels: usize,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "coreclient")]
pub enum MqClientError {
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
    #[error("Connection does not exist")]
    #[editoast_error(status = "500")]
    ConnectionDoesNotExist,
    #[error("Fail to pool a channel")]
    #[editoast_error(status = "500")]
    PoolChannelFail,
}

#[derive(Debug)]
pub struct MQResponse {
    pub payload: Vec<u8>,
    pub status: Vec<u8>,
}

const SINGLE_WORKER_KEY: &str = "all";

impl RabbitMQClient {
    pub async fn new(options: Options) -> Result<Self, MqClientError> {
        let hostname = hostname::get()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "unknown".to_string());

        let conn = Arc::new(RwLock::new(None));

        tokio::spawn(Self::connection_loop(
            options.uri,
            hostname.clone(),
            conn.clone(),
        ));

        // We should ensure that the connection is established at least once before creating the pool
        // since deadpool will try to create resources upfront
        const MAX_RETRIES: usize = 10;
        const RETRY_DELAY: Duration = Duration::from_secs(1);

        let mut retries = 0;
        while retries < MAX_RETRIES {
            if Self::connection_ok(&conn).await {
                break;
            }
            tokio::time::sleep(RETRY_DELAY).await;
            retries += 1;
        }

        if retries == MAX_RETRIES {
            return Err(MqClientError::ConnectionDoesNotExist);
        }

        // Create the pool
        let pool = Pool::builder(ChannelManager::new(conn, hostname))
            .max_size(options.num_channels)
            .build()
            .map_err(|_| MqClientError::ConnectionDoesNotExist)?;

        Ok(RabbitMQClient {
            pool,
            exchange: format!("{}-req-xchg", options.worker_pool_identifier),
            timeout: options.timeout,
            single_worker: options.single_worker,
        })
    }

    pub async fn ping(&self) -> Result<bool, MqClientError> {
        let channel_worker = self
            .pool
            .get()
            .await
            .map_err(|_| MqClientError::PoolChannelFail)?;
        let channel = channel_worker.get_channel();
        Ok(channel.status().connected())
    }

    async fn connection_ok(connection: &Arc<RwLock<Option<Connection>>>) -> bool {
        let guard = connection.as_ref().read().await;
        let conn = guard.as_ref();
        let status = match conn {
            None => return false,
            Some(conn) => conn.status().state(),
        };
        match status {
            lapin::ConnectionState::Initial => false,
            lapin::ConnectionState::Connecting => false,
            lapin::ConnectionState::Connected => true,
            lapin::ConnectionState::Closing => false,
            lapin::ConnectionState::Closed => false,
            lapin::ConnectionState::Error => false,
        }
    }

    async fn connection_loop(
        uri: String,
        hostname: String,
        connection: Arc<RwLock<Option<Connection>>>,
    ) {
        loop {
            if Self::connection_ok(&connection).await {
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }

            tracing::info!("Reconnecting to RabbitMQ");

            // Connection should be re-established
            let new_connection = Connection::connect(
                &uri,
                ConnectionProperties::default().with_connection_name(hostname.clone().into()),
            )
            .await;

            match new_connection {
                Ok(new_connection) => {
                    *connection.write().await = Some(new_connection);
                    tracing::info!("Reconnected to RabbitMQ");
                }
                Err(e) => {
                    tracing::error!("Error while reconnecting to RabbitMQ: {:?}", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }

    #[allow(dead_code)]
    pub async fn call<T>(
        &self,
        routing_key: String,
        path: &str,
        published_payload: &T,
        mandatory: bool,
        correlation_id: Option<String>,
    ) -> Result<(), MqClientError>
    where
        T: Serialize,
    {
        // Get the next channel
        let channel_worker = self
            .pool
            .get()
            .await
            .map_err(|_| MqClientError::PoolChannelFail)?;
        let channel = channel_worker.get_channel();

        let serialized_payload_vec =
            to_vec(published_payload).map_err(MqClientError::Serialization)?;
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
                if self.single_worker {
                    SINGLE_WORKER_KEY
                } else {
                    routing_key.as_str()
                },
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(MqClientError::Lapin)?;

        Ok(())
    }

    pub async fn call_with_response<T>(
        &self,
        routing_key: String,
        path: &str,
        published_payload: &Option<T>,
        mandatory: bool,
        override_timeout: Option<u64>,
    ) -> Result<MQResponse, MqClientError>
    where
        T: Serialize,
    {
        let correlation_id = Uuid::new_v4().to_string();

        // Get the next channel
        let channel_worker = self
            .pool
            .get()
            .await
            .map_err(|_| MqClientError::PoolChannelFail)?;
        let channel = channel_worker.get_channel();

        let serialized_payload_vec =
            to_vec(published_payload).map_err(MqClientError::Serialization)?;
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
            .with_correlation_id(ShortString::from(correlation_id.clone()))
            .with_headers(headers);

        let (tx, rx) = oneshot::channel();
        channel_worker
            .register_response_tracker(correlation_id.clone(), tx)
            .await;

        // Publish the message
        channel
            .basic_publish(
                self.exchange.as_str(),
                if self.single_worker {
                    SINGLE_WORKER_KEY
                } else {
                    routing_key.as_str()
                },
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(MqClientError::Lapin)?;

        // Release from the pool
        drop(channel_worker);

        match timeout(
            Duration::from_secs(override_timeout.unwrap_or(self.timeout)),
            rx,
        )
        .await
        {
            Ok(Ok(delivery)) => {
                let status = delivery
                    .properties
                    .headers()
                    .as_ref()
                    .and_then(|f| f.inner().get("x-status"))
                    .and_then(|s| s.as_byte_array())
                    .map(|s| Ok(s.as_slice().to_owned()))
                    .unwrap_or(Err(MqClientError::StatusParsing))?;

                Ok(MQResponse {
                    payload: delivery.data,
                    status,
                })
            }
            Ok(Err(_)) | Err(_) => Err(MqClientError::ResponseTimeout),
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
