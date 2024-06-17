use std::{collections::BTreeMap, sync::Arc};

use futures_lite::stream::StreamExt;
use lapin::{options::{BasicConsumeOptions, BasicQosOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions}, types::FieldTable, Channel, Connection, ExchangeKind::{Direct, Fanout}};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use tokio::{sync::oneshot, task::JoinSet};

use crate::{management_client::{ArgumentValue, ManagementClient, Policy, PolicyScope}, queue_controller::queues_control_loop, target_tracker::TargetTrackerClient, watch_logger::watch_logger, Key};


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

    pool_req_prefix: String,
    request_queue_policy: BTreeMap<String, ArgumentValue>,
}

impl Pool {
    pub fn new(raw_pool_id: String, request_queue_policy: BTreeMap<String, ArgumentValue>) -> Self {
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

            pool_req_prefix,
            request_queue_policy,
        }
    }

    pub fn parse_key(&self, queue_name: &str) -> Option<Key> {
        queue_name.strip_prefix(&self.pool_req_prefix)
            .map(Key::decode)
    }

    pub fn key_queue_name(&self, key: &Key) -> String {
        format!("{}{}", self.pool_req_prefix, key.encode())
    }

    pub async fn setup(&self, conn: &Connection, management_client: &ManagementClient) -> anyhow::Result<()> {
        // create exchanges
        let chan = conn.create_channel().await?;
        chan.exchange_declare(&self.request_xchg, Direct, ExchangeDeclareOptions::default(), FieldTable::default()).await?;
        chan.exchange_declare(&self.orphan_xchg, Fanout, ExchangeDeclareOptions::default(), FieldTable::default()).await?;
        chan.exchange_declare(&self.deadletter_xchg, Fanout, ExchangeDeclareOptions::default(), FieldTable::default()).await?;
        chan.exchange_declare(&self.activity_xchg, Fanout, ExchangeDeclareOptions::default(), FieldTable::default()).await?;

        // setup the policy for the request exchange
        management_client.set_policy(format!("{}-req-xchg", self.pool_id), Policy {
            pattern: self.request_xchg.clone(),
            definition: BTreeMap::from([
                ("dead-letter-exchange".into(), ArgumentValue::String(self.deadletter_xchg.clone())),
                ("alternate-exchange".into(), ArgumentValue::String(self.orphan_xchg.clone())),
            ]),
            priority: Some(10),
            apply_to: Some(PolicyScope::Exchanges),
        }).await?;

        // setup the policy for request queues
        let request_queues_policy_id = format!("{}-req-queues", self.pool_id);
        if self.request_queue_policy.is_empty() {
            management_client.remove_policy(request_queues_policy_id).await?;
        } else {
            management_client.set_policy(request_queues_policy_id, Policy {
                pattern: format!("^{}", self.pool_req_prefix),
                definition: self.request_queue_policy.clone(),
                priority: Some(10),
                apply_to: Some(PolicyScope::Queues),
            }).await?;
        }

        // create queues
        let exclusive = QueueDeclareOptions {
            exclusive: true,
            durable: true,
            auto_delete: false,
            ..Default::default()
        };
        chan.queue_declare(&self.orphan_queue, exclusive, FieldTable::default()).await?;
        chan.queue_declare(&self.deadletter_queue, exclusive, FieldTable::default()).await?;
        chan.queue_declare(&self.activity_queue, exclusive, FieldTable::default()).await?;
        chan.queue_declare(&self.poison_queue, exclusive, FieldTable::default()).await?;

        // bind queues to exchanges
        chan.queue_bind(&self.orphan_queue, &self.orphan_xchg, "", QueueBindOptions::default(), FieldTable::default()).await?;
        chan.queue_bind(&self.deadletter_queue, &self.deadletter_xchg, "", QueueBindOptions::default(), FieldTable::default()).await?;
        chan.queue_bind(&self.activity_queue, &self.activity_xchg, "", QueueBindOptions::default(), FieldTable::default()).await?;

        Ok(())
    }

    pub async fn start(self: Arc<Self>, conn: &Connection, management_client: &ManagementClient, tracker_client: TargetTrackerClient) -> anyhow::Result<JoinSet<()>> {
        let mut tasks = JoinSet::new();
        // start control loops
        let expected_state = tracker_client.subscribe().await?;
        tasks.spawn(watch_logger("target state".into(), expected_state.clone()));
        // tasks.spawn(worker_control_loop(expected_state.clone()));
        let (queue_status_sender, queue_status_receiver) = oneshot::channel();
        let queue_channel = conn.create_channel().await?;

        let init_queues = management_client.list_queues().await?;
        let init_keys: Vec<Key> = init_queues.into_iter().filter_map(|q| self.parse_key(&q.name)).collect();
        tasks.spawn(queues_control_loop(self.clone(), queue_channel, init_keys, expected_state, queue_status_sender));
        let queue_status = queue_status_receiver.await?;
        tasks.spawn(watch_logger("queue status".into(), queue_status));

        // start the message processors
        // let activity_channel = conn.create_channel().await?;
        // let orphan_channel = conn.create_channel().await?;

        // tasks.spawn(activity_processor(self.activity_queue.clone(), activity_channel, tracker_client.clone()));
        // tasks.spawn(orphan_processor(self.orphan_queue.clone(), orphan_channel, tracker_client.clone(), queue_status));
        // tasks.spawn(deadletter_responder());

        Ok(tasks)
    }
}

async fn orphan_processor(pool: Arc<Pool>, chan: Channel, tracker_client: TargetTrackerClient, queues_status: Receiver<TargetUpdate>) {
    chan.basic_qos(200, BasicQosOptions::default()).await?;

    let consumer_tag = format!("{}-orphan-processor", pool.pool_id);
    let options = BasicConsumeOptions {
        exclusive: true,
        ..Default::default()
    };
    let mut consumer = chan.basic_consume(&pool.orphan_queue, &consumer_tag, options, FieldTable::default()).await?;
    while let Some(delivery) = consumer.next().await {

    }
    Ok(())
}

/*
async fn activity_processor(pool: Arc<Pool>, activity_queue: String, chan: Channel, client: TargetTrackerClient) -> anyhow::Result<()> {
}

async fn worker_control_loop(_expected_state: Receiver<TargetUpdate>) {
}

async fn deadletter_responder() {
}
*/
