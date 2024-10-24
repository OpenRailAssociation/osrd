use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
    time::Duration,
};

use futures_lite::stream::StreamExt;
use lapin::{
    options::{
        BasicConsumeOptions, BasicPublishOptions, BasicQosOptions, ExchangeDeclareOptions,
        QueueBindOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    BasicProperties, Channel, Connection,
    ExchangeKind::{Direct, Fanout},
};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use tokio::{sync::oneshot, task::JoinSet};
use tracing::{error, info, span, Level};

use crate::{
    drivers::worker_driver::WorkerMetadata,
    management_client::{ArgumentValue, ManagementClient, Policy, PolicyScope},
    queue_controller::{queues_control_loop, QueuesState},
    target_tracker::{QueueStatus, TargetTrackerClient, TargetUpdate},
    watch_logger::watch_logger,
    Key, WorkerDriver,
};

pub struct Pool {
    // the percent encoded pool ID
    pool_id: String,

    pub request_xchg: String,
    pub orphan_xchg: String,
    pub deadletter_xchg: String,
    pub activity_xchg: String,

    pub orphan_queue: String,
    pub deadletter_queue: String,
    pub activity_queue: String,
    pub poison_queue: String,

    pub extra_lifetime: Duration,

    pub worker_loop_interval: Duration,

    pool_req_prefix: String,
    request_queue_policy: BTreeMap<String, ArgumentValue>,
}

impl Pool {
    pub fn new(
        raw_pool_id: String,
        request_queue_policy: BTreeMap<String, ArgumentValue>,
        extra_lifetime: Duration,
        worker_loop_interval: Duration,
    ) -> Self {
        let pool_id = utf8_percent_encode(&raw_pool_id, NON_ALPHANUMERIC).to_string();

        let request_xchg = format!("{pool_id}-req-xchg");
        let orphan_xchg = format!("{pool_id}-orphan-xchg");
        let deadletter_xchg = format!("{pool_id}-deadletter-xchg");
        let activity_xchg = format!("{pool_id}-activity-xchg");

        let orphan_queue = format!("{pool_id}-orphan");
        let deadletter_queue = format!("{pool_id}-deadletter");
        let activity_queue = format!("{pool_id}-activity");
        let poison_queue = format!("{pool_id}-poison");

        let pool_req_prefix = format!("{pool_id}-req-");

        Self {
            pool_id,

            request_xchg,
            orphan_xchg,
            deadletter_xchg,
            activity_xchg,

            orphan_queue,
            deadletter_queue,
            activity_queue,
            poison_queue,

            extra_lifetime,

            pool_req_prefix,
            request_queue_policy,
            worker_loop_interval,
        }
    }

    pub fn parse_key(&self, queue_name: &str) -> Option<Key> {
        queue_name
            .strip_prefix(&self.pool_req_prefix)
            .map(Key::decode)
    }

    pub fn key_queue_name(&self, key: &Key) -> String {
        format!("{}{}", self.pool_req_prefix, key.encode())
    }

    pub async fn setup(
        &self,
        conn: &Connection,
        management_client: &ManagementClient,
    ) -> anyhow::Result<()> {
        info!(pool_id = %self.pool_id, "Setting up pool");

        // create exchanges
        let chan = conn.create_channel().await?;
        chan.exchange_declare(
            &self.request_xchg,
            Direct,
            ExchangeDeclareOptions::default(),
            FieldTable::default(),
        )
        .await?;
        chan.exchange_declare(
            &self.orphan_xchg,
            Fanout,
            ExchangeDeclareOptions::default(),
            FieldTable::default(),
        )
        .await?;
        chan.exchange_declare(
            &self.deadletter_xchg,
            Fanout,
            ExchangeDeclareOptions::default(),
            FieldTable::default(),
        )
        .await?;
        chan.exchange_declare(
            &self.activity_xchg,
            Fanout,
            ExchangeDeclareOptions::default(),
            FieldTable::default(),
        )
        .await?;

        // setup the policy for the request exchange
        management_client
            .set_policy(
                format!("{}-req-xchg", self.pool_id),
                Policy {
                    pattern: self.request_xchg.clone(),
                    definition: BTreeMap::from([
                        (
                            "dead-letter-exchange".into(),
                            ArgumentValue::String(self.deadletter_xchg.clone()),
                        ),
                        (
                            "alternate-exchange".into(),
                            ArgumentValue::String(self.orphan_xchg.clone()),
                        ),
                    ]),
                    priority: Some(10),
                    apply_to: Some(PolicyScope::Exchanges),
                },
            )
            .await?;

        // setup the policy for request queues
        let request_queues_policy_id = format!("{}-req-queues", self.pool_id);
        if self.request_queue_policy.is_empty() {
            management_client
                .remove_policy(request_queues_policy_id)
                .await?;
        } else {
            management_client
                .set_policy(
                    request_queues_policy_id,
                    Policy {
                        pattern: format!("^{}", self.pool_req_prefix),
                        definition: self.request_queue_policy.clone(),
                        priority: Some(10),
                        apply_to: Some(PolicyScope::Queues),
                    },
                )
                .await?;
        }

        // create queues
        let exclusive = QueueDeclareOptions {
            exclusive: true,
            durable: true,
            auto_delete: false,
            ..Default::default()
        };
        chan.queue_declare(&self.orphan_queue, exclusive, FieldTable::default())
            .await?;
        chan.queue_declare(&self.deadletter_queue, exclusive, FieldTable::default())
            .await?;
        chan.queue_declare(&self.activity_queue, exclusive, FieldTable::default())
            .await?;
        chan.queue_declare(&self.poison_queue, exclusive, FieldTable::default())
            .await?;

        // bind queues to exchanges
        chan.queue_bind(
            &self.orphan_queue,
            &self.orphan_xchg,
            "",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
        chan.queue_bind(
            &self.deadletter_queue,
            &self.deadletter_xchg,
            "",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
        chan.queue_bind(
            &self.activity_queue,
            &self.activity_xchg,
            "",
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;

        Ok(())
    }

    pub async fn start(
        self: Arc<Self>,
        conn: &Connection,
        driver: Box<dyn WorkerDriver>,
        management_client: &ManagementClient,
        tracker_client: TargetTrackerClient,
        running_worker_watch: tokio::sync::watch::Sender<Arc<Vec<WorkerMetadata>>>,
        status_tracker: tokio::sync::mpsc::Sender<ActivityMessage>,
    ) -> anyhow::Result<JoinSet<anyhow::Result<()>>> {
        let worker_loop_interval = self.worker_loop_interval;

        let mut tasks = JoinSet::new();
        // start control loops
        let expected_state = tracker_client.subscribe().await?;
        {
            let expected_state = expected_state.clone();
            tasks.spawn(async {
                watch_logger("target state".into(), expected_state).await;
                Ok(())
            });
        }

        {
            let arc_clone = self.clone();
            let expected_state = expected_state.clone();
            tasks.spawn(async move {
                worker_control_loop(
                    arc_clone,
                    expected_state,
                    running_worker_watch,
                    driver,
                    worker_loop_interval,
                )
                .await;
                Ok(())
            });
        }
        let (queue_status_sender, queue_status_receiver) = oneshot::channel();
        let queue_channel = conn.create_channel().await?;

        let init_queues = management_client.list_queues().await?;
        let init_keys: Vec<Key> = init_queues
            .into_iter()
            .filter_map(|q| self.parse_key(&q.name))
            .collect();
        {
            let pool = self.clone();
            tasks.spawn(async move {
                queues_control_loop(
                    pool,
                    queue_channel,
                    init_keys,
                    expected_state,
                    queue_status_sender,
                )
                .await;
                Ok(())
            });
        }
        let queue_status = queue_status_receiver.await?;
        {
            let queue_status = queue_status.clone();
            tasks.spawn(async {
                watch_logger("queue status".into(), queue_status).await;
                Ok(())
            });
        }

        // start the message processors
        let activity_channel = conn.create_channel().await?;
        let orphan_channel = conn.create_channel().await?;
        let deadletter_channel = conn.create_channel().await?;

        tasks.spawn(activity_processor(
            self.clone(),
            activity_channel,
            tracker_client.clone(),
            status_tracker,
            self.extra_lifetime,
        ));
        tasks.spawn(orphan_processor(
            self.clone(),
            orphan_channel,
            tracker_client.clone(),
            queue_status,
            self.extra_lifetime,
        ));
        tasks.spawn(deadletter_responder(self.clone(), deadletter_channel));

        Ok(tasks)
    }
}

async fn orphan_processor(
    pool: Arc<Pool>,
    chan: Channel,
    tracker_client: TargetTrackerClient,
    mut queues_status: tokio::sync::watch::Receiver<QueuesState>,
    extra_lifetime: Duration,
) -> anyhow::Result<()> {
    chan.basic_qos(200, BasicQosOptions::default()).await?;

    let consumer_tag = format!("{}-orphan-processor", pool.pool_id);
    let options = BasicConsumeOptions {
        exclusive: true,
        ..Default::default()
    };
    let mut consumer = chan
        .basic_consume(
            &pool.orphan_queue,
            &consumer_tag,
            options,
            FieldTable::default(),
        )
        .await?;
    while let Some(delivery) = consumer.next().await {
        let delivery = delivery?;
        let routing_key = delivery.routing_key.as_str();
        let key = Key::decode(routing_key);

        // Require queue creation
        // FIXME: understand the implications of the zero extra duration
        let generation = tracker_client
            .require_worker_group(key.clone(), extra_lifetime)
            .await?;

        // Wait for the queue control loop to catch up and create the queue
        while queues_status.borrow_and_update().target_generation < generation {
            queues_status.changed().await?;
        }

        while queues_status.borrow_and_update().queues.get(&key) == Some(&QueueStatus::Active) {
            queues_status.changed().await?;
        }

        // Republish message
        chan.basic_publish(
            &pool.request_xchg,
            routing_key,
            BasicPublishOptions::default(),
            &delivery.data,
            delivery.properties,
        )
        .await?;

        chan.basic_ack(delivery.delivery_tag, Default::default())
            .await?;
    }
    Ok(())
}

pub struct ActivityMessage {
    pub kind: ActivityMessageKind,
    pub worker_key: Key,
    pub worker_id: String,
}

pub enum ActivityMessageKind {
    Ready,
    Unknown,
}

impl ActivityMessageKind {
    pub fn from_bytes(s: &[u8]) -> Self {
        match s {
            b"ready" => Self::Ready,
            _ => Self::Unknown,
        }
    }
}

async fn activity_processor(
    pool: Arc<Pool>,
    chan: Channel,
    client: TargetTrackerClient,
    status_tracker: tokio::sync::mpsc::Sender<ActivityMessage>,
    extra_lifetime: Duration,
) -> anyhow::Result<()> {
    chan.basic_qos(200, BasicQosOptions::default()).await?;

    let consumer_tag = format!("{}-activity-processor", pool.pool_id);
    let options = BasicConsumeOptions {
        no_ack: true,
        ..Default::default()
    };
    let mut consumer = chan
        .basic_consume(
            &pool.activity_queue,
            &consumer_tag,
            options,
            FieldTable::default(),
        )
        .await?;

    let mut last_activities = HashMap::new();

    while let Some(delivery) = consumer.next().await {
        let delivery = delivery?;
        let routing_key = delivery.routing_key.as_str();
        let key = Key::decode(routing_key);
        let now = std::time::Instant::now();

        let headers = delivery.properties.headers();
        let worker_id = headers
            .as_ref()
            .and_then(|h| h.inner().get("x-worker-id"))
            .and_then(|v| v.as_long_string().map(|s| s.as_bytes()));

        if let Some(worker_id) = worker_id {
            let Ok(worker_id) = String::from_utf8(worker_id.to_vec()) else {
                continue;
            };

            let kind = headers
                .as_ref()
                .and_then(|h| h.inner().get("x-event"))
                .and_then(|v| v.as_long_string())
                .map(|s| s.as_bytes())
                .map(ActivityMessageKind::from_bytes)
                .unwrap_or(ActivityMessageKind::Unknown);

            let activity = ActivityMessage {
                kind,
                worker_key: key.clone(),
                worker_id,
            };
            status_tracker.send(activity).await?;
        }

        // debouncing
        if let Some(&last_activity) = last_activities.get(&key) {
            if last_activity + extra_lifetime < now {
                last_activities.insert(key.clone(), now);
                continue;
            }
        }
        last_activities.insert(key.clone(), now);

        // Update the state tracker
        let _ = client.require_worker_group(key, extra_lifetime).await;
    }
    Ok(())
}

async fn worker_control_loop(
    pool: Arc<Pool>,
    expected_state: tokio::sync::watch::Receiver<TargetUpdate>,
    running_workers_watch: tokio::sync::watch::Sender<Arc<Vec<WorkerMetadata>>>,
    mut driver: Box<dyn WorkerDriver>,
    sleep_interval: Duration,
) {
    loop {
        let span = span!(Level::INFO, "loop_iteration");
        let _enter = span.enter();

        let target = expected_state.borrow().clone();

        let current_workers = match driver.list_worker_groups().await {
            Ok(workers) => workers,
            Err(e) => {
                error!(
                    ?e,
                    "Failed to list worker groups. Aborting current loop iteration."
                );
                tokio::time::sleep(sleep_interval).await;
                continue;
            }
        };

        let current_workers = Arc::new(current_workers);
        let _ = running_workers_watch.send(current_workers.clone());

        let current_worker_keys = current_workers
            .iter()
            .map(|c| &c.worker_key)
            .collect::<Vec<_>>();

        let wanted_worker_keys = target
            .queues
            .into_iter()
            .map(|(k, _)| k)
            .collect::<Vec<_>>();

        // Remove unwanted groups
        for worker_key in current_worker_keys {
            if !wanted_worker_keys.contains(worker_key) {
                if let Err(e) = driver.destroy_worker_group(worker_key.clone()).await {
                    error!(
                        ?e,
                        "Failed to destroy worker group. Aborting current loop iteration."
                    );
                    tokio::time::sleep(sleep_interval).await;
                    continue;
                }
            }
        }

        // Add wanted groups
        for worker_key in wanted_worker_keys {
            let queue_name = pool.key_queue_name(&worker_key);
            if let Err(e) = driver
                .get_or_create_worker_group(queue_name, worker_key)
                .await
            {
                error!(
                    ?e,
                    "Failed to get or create worker group. Aborting current loop iteration."
                );
                tokio::time::sleep(sleep_interval).await;
                continue;
            }
        }

        // Refresh workers if needed
        if let Err(e) = driver.cleanup_stalled().await {
            error!(
                ?e,
                "Failed to cleanup stalled resources. Aborting current loop iteration."
            );
            tokio::time::sleep(sleep_interval).await;
            continue;
        }

        // Sleep for a while
        tokio::time::sleep(sleep_interval).await;
    }
}

async fn deadletter_responder(pool: Arc<Pool>, chan: Channel) -> anyhow::Result<()> {
    chan.basic_qos(200, BasicQosOptions::default()).await?;

    let consumer_tag = format!("{}-deadletter-responder", pool.pool_id);
    let options = BasicConsumeOptions {
        exclusive: true,
        ..Default::default()
    };
    let mut consumer = chan
        .basic_consume(
            &pool.deadletter_queue,
            &consumer_tag,
            options,
            FieldTable::default(),
        )
        .await?;

    while let Some(delivery) = consumer.next().await {
        let delivery = delivery?;
        let Some(reply_to) = delivery.properties.reply_to() else {
            continue;
        };

        let Some(first_death) = delivery
            .properties
            .headers()
            .as_ref()
            .and_then(|h| h.inner().get("x-first-death"))
        else {
            error!(?delivery, "Deadletter message without x-first-death header");
            continue;
        };

        let mut headers = FieldTable::default();
        headers.insert("x-status".into(), first_death.clone());

        // FIXME: design the response protocol...
        let payload = b"";
        chan.basic_publish(
            "",
            reply_to.as_str(),
            BasicPublishOptions::default(),
            payload,
            BasicProperties::default().with_headers(headers),
        )
        .await?;
    }

    Ok(())
}
