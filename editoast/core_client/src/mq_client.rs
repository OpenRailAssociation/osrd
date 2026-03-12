use dashmap::DashMap;
use deadpool::managed::Manager;
use deadpool::managed::Metrics;
use deadpool::managed::Pool;
use deadpool::managed::RecycleError;
use deadpool::managed::RecycleResult;
use educe::Educe;
use itertools::Itertools;
use lapin::BasicProperties;
use lapin::Channel;
use lapin::Connection;
use lapin::ConnectionProperties;
use lapin::message::Delivery;
use lapin::options::BasicConsumeOptions;
use lapin::options::BasicPublishOptions;
use lapin::types::ByteArray;
use lapin::types::FieldTable;
use lapin::types::ShortString;
use serde::Serialize;
use serde_json::to_vec;
use std::fmt::Debug;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::sync::mpsc;
use tokio::task;
use tokio::time::Duration;
use tokio_stream::StreamExt;
use tracing::Instrument;
use url::Url;
use uuid::Uuid;

const NON_TERMINATING_RESPONSE_HEADER: &str = "x-non-terminating-response";

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
    response_tracker: Arc<DashMap<String, mpsc::UnboundedSender<Delivery>>>,
}

impl ChannelManager {
    pub fn new(connection: Arc<RwLock<Option<Connection>>>, hostname: String) -> Self {
        ChannelManager {
            connection,
            hostname,
            response_tracker: Arc::new(DashMap::new()),
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

            Ok(ChannelWorker::new(
                Arc::new(channel),
                self.hostname.clone(),
                self.response_tracker.clone(),
            )
            .await)
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
    response_tracker: Arc<DashMap<String, mpsc::UnboundedSender<Delivery>>>,
    consumer_tag: String,
}

impl ChannelWorker {
    pub async fn new(
        channel: Arc<Channel>,
        hostname: String,
        response_tracker: Arc<DashMap<String, mpsc::UnboundedSender<Delivery>>>,
    ) -> Self {
        let worker = ChannelWorker {
            channel,
            response_tracker,
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
        tx: mpsc::UnboundedSender<Delivery>,
    ) {
        self.response_tracker.insert(correlation_id, tx);
    }

    pub fn should_reuse(&self) -> bool {
        self.channel.status().connected()
    }

    async fn dispatching_loop(&self) {
        let channel = self.channel.clone();
        let response_tracker = self.response_tracker.clone();
        let consumer_tag = self.consumer_tag.clone();

        let mut consumer = channel
            .basic_consume(
                "amq.rabbitmq.reply-to".into(),
                consumer_tag.into(),
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
                let Some(correlation_id) = delivery
                    .properties
                    .correlation_id()
                    .as_ref()
                    .map(|s| s.to_string())
                else {
                    tracing::error!("Received message without correlation_id");
                    continue;
                };

                let final_message = !delivery
                    .properties
                    .headers()
                    .as_ref()
                    .and_then(|f| f.inner().get(NON_TERMINATING_RESPONSE_HEADER))
                    .and_then(|s| s.as_bool())
                    .unwrap_or(false);

                let Some(sender_entry) = response_tracker
                    .get(correlation_id.as_str())
                    .map(|entry| entry.value().clone())
                else {
                    tracing::error!(
                        "Received message with unknown correlation_id: {}",
                        correlation_id
                    );
                    continue;
                };

                let response = sender_entry.send(delivery);
                if response.is_err() || final_message {
                    // Response channel is closed or it was the last response
                    response_tracker.remove(correlation_id.as_str());
                }
            }
        });
    }
}

pub struct Options {
    /// format `amqp://username:password@host:port/vhost`
    /// for instance: `amqp://osrd:password@localhost:5672/%2f` for the default vhost
    pub uri: Url,
    /// Exchange name
    pub worker_pool_identifier: String,
    /// Default timeout for the response
    pub timeout: u64,
    pub single_worker: bool,
    pub num_channels: usize,
}

#[derive(Debug, Error, Educe)]
#[educe(PartialEq)]
pub enum MqClientError {
    #[error("AMQP error: {0}")]
    Lapin(#[from] lapin::Error),
    #[error("Cannot serialize request: {0}")]
    Serialization(#[educe(PartialEq(ignore))] serde_json::Error),
    #[error("Cannot parse response status")]
    StatusParsing,
    #[error("Response channel was closed due to a delivery error")]
    ResponseChannelClosed,
    #[error("Response timeout")]
    ResponseTimeout,
    #[error("Connection does not exist")]
    ConnectionDoesNotExist,
    #[error("Fail to pool a channel")]
    PoolChannelFail,
}

#[derive(Debug)]
pub struct MQResponse {
    pub payload: Vec<u8>,
    pub status: Vec<u8>,
}

const SINGLE_WORKER_KEY: &str = "all";

impl RabbitMQClient {
    #[tracing::instrument(skip_all, err, level = "info", name = "RabbitMQClient::new")]
    pub async fn new(options: Options) -> Result<Self, MqClientError> {
        let hostname = hostname::get()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "unknown".to_string());

        let conn = Arc::new(RwLock::new(None));

        // We want to be signalled when the first connection is established to avoid wasting
        // retries and introduce unnecessary latency.
        let (tx, rx) = tokio::sync::oneshot::channel();
        tokio::spawn(Self::connection_loop(
            options.uri,
            hostname.clone(),
            conn.clone(),
            tx,
        ));
        rx.instrument(tracing::info_span!("waiting for first connection signal"))
            .await
            .ok();

        // We should ensure that the connection is established at least once before creating the pool
        // since deadpool will try to create resources upfront
        const MAX_RETRIES: usize = 11;
        const MAX_RETRY_DELAY: Duration = Duration::from_secs(1); // max reached after 5th attempt
        let mut retry_delay = Duration::from_millis(25); // fails after 6800ms, ie. up to three reconnections of 2s

        let mut retries = 0;
        while retries < MAX_RETRIES {
            if Self::connection_ok(&conn)
                .instrument(tracing::info_span!("RabbitMQClient::connection_ok")) // not instrumented at function-level to avoid spamming traces in connection_loop
                .await
            {
                break;
            }
            tokio::time::sleep(retry_delay.min(MAX_RETRY_DELAY)).await;
            retries += 1;
            retry_delay *= 2;
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

    #[tracing::instrument(name = "ping_mq", skip_all)]
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
        match conn {
            None => false,
            Some(conn) => conn.status().connected(),
        }
    }

    async fn connection_loop(
        uri: Url,
        hostname: String,
        connection: Arc<RwLock<Option<Connection>>>,
        initial_connection_ok_signal: tokio::sync::oneshot::Sender<()>,
    ) {
        let mut tx = Some(initial_connection_ok_signal);
        loop {
            if Self::connection_ok(&connection).await {
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }

            tracing::info!("Reconnecting to RabbitMQ");

            // Connection should be re-established
            let new_connection = Connection::connect(
                uri.as_str(),
                ConnectionProperties::default().with_connection_name(hostname.clone().into()),
            )
            .await;

            match new_connection {
                Ok(new_connection) => {
                    *connection.write().await = Some(new_connection);
                    if let Some(tx) = tx.take() {
                        tx.send(()).ok();
                    }
                    tracing::info!("Reconnected to RabbitMQ");
                }
                Err(e) => {
                    tracing::error!("Error while reconnecting to RabbitMQ: {:?}", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }

    // Left here because its isolated, its not increasing the surface of attack,
    // its not making the maintenance more complex since it is small
    // and the API is complete with it since it is part of the API
    // we designed around RMQ.
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
                self.exchange.clone().into(),
                if self.single_worker {
                    SINGLE_WORKER_KEY.into()
                } else {
                    routing_key.into()
                },
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(MqClientError::Lapin)?;

        Ok(())
    }

    pub async fn call_with_multiple_responses<T>(
        &self,
        routing_key: String,
        path: &str,
        published_payload: Option<&T>,
        mandatory: bool,
        override_timeout: Option<Duration>,
    ) -> Result<impl tokio_stream::Stream<Item = Result<MQResponse, MqClientError>>, MqClientError>
    where
        T: Serialize,
    {
        let correlation_id = Uuid::new_v4().to_string();
        let timeout = override_timeout.unwrap_or_else(|| Duration::from_secs(self.timeout));

        // Get the next channel
        let channel_worker = self
            .pool
            .get()
            .await
            .map_err(|_| MqClientError::PoolChannelFail)?;
        let channel = channel_worker.get_channel();

        let serialized_payload_vec =
            to_vec(&published_payload).map_err(MqClientError::Serialization)?;
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
            .with_correlation_id(ShortString::from(correlation_id.as_str()))
            .with_expiration(timeout.as_millis().to_string().into())
            .with_headers(headers);

        let (tx, rx) = mpsc::unbounded_channel();
        channel_worker
            .register_response_tracker(correlation_id.clone(), tx)
            .await;

        // Publish the message
        channel
            .basic_publish(
                self.exchange.clone().into(),
                if self.single_worker {
                    SINGLE_WORKER_KEY.into()
                } else {
                    routing_key.into()
                },
                options,
                serialized_payload,
                properties,
            )
            .await
            .map_err(MqClientError::Lapin)?;

        // Release from the pool
        drop(channel_worker);

        let mut finished = false;

        let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx)
            .timeout(timeout)
            .map(|result| match result {
                Ok(delivery) => {
                    let headers = delivery.properties.headers().as_ref();
                    let status = headers
                        .and_then(|f| f.inner().get("x-status"))
                        .and_then(|s| s.as_byte_array())
                        .map(|s| Ok(s.as_slice().to_owned()))
                        .unwrap_or(Err(MqClientError::StatusParsing));

                    let final_message = !headers
                        .and_then(|f| f.inner().get(NON_TERMINATING_RESPONSE_HEADER))
                        .and_then(|s| s.as_bool())
                        .unwrap_or(false);

                    (
                        status.map(|status| MQResponse {
                            payload: delivery.data,
                            status,
                        }),
                        final_message,
                    )
                }
                Err(_) => (Err(MqClientError::ResponseTimeout), true),
            })
            .map_while(move |(payload, final_message)| {
                if finished {
                    return None;
                }
                finished = final_message;
                Some(payload)
            });

        Ok(stream)
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
