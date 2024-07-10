use lapin::Connection;
use lapin::ConnectionProperties;
use log::error;
use log::info;
use std::collections::BTreeMap;
use std::sync::Arc;
use tokio::select;
use tokio::signal;
use tokio::spawn;
use tokio::sync::mpsc;

use crate::management_client::ArgumentValue;
use crate::management_client::ManagementClient;
use crate::target_tracker::target_tracker_actor;
use crate::target_tracker::TargetTrackerClient;
use crate::target_tracker::TargetTrackerConfig;

use crate::config::WorkerDriverConfig;
use crate::drivers::docker::DockerDriver;
use crate::drivers::kubernetes::KubernetesDriver;
use crate::drivers::noop::NoopDriver;
use crate::drivers::worker_driver::WorkerDriver;

mod api;
mod config;
mod drivers;
mod key;
mod management_client;
mod pool;
mod queue_controller;
mod target_tracker;
mod watch_logger;

pub use key::Key;
pub use pool::Pool;

use config::{parse_config, OsrdyneConfig};

fn request_queues_policy(config: &OsrdyneConfig) -> BTreeMap<String, ArgumentValue> {
    let mut request_queues_policy = BTreeMap::new();
    if let Some(default_message_ttl) = config.default_message_ttl {
        request_queues_policy.insert(
            "message-ttl".into(),
            ArgumentValue::Int(default_message_ttl),
        );
    }
    if let Some(max_length) = config.max_length {
        request_queues_policy.insert("max-length".into(), ArgumentValue::Int(max_length));
    }
    if let Some(max_length_bytes) = config.max_length_bytes {
        request_queues_policy.insert(
            "max-length-bytes".into(),
            ArgumentValue::Int(max_length_bytes),
        );
    }
    request_queues_policy
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    env_logger::init();

    let config = parse_config()?;
    log::info!("config: {:?}", &config);
    let pool = Arc::new(Pool::new(
        config.pool_id.clone(),
        request_queues_policy(&config),
    ));

    // fetch the list of queues from the web API
    let management_client = ManagementClient::try_from(&config)?;
    let init_queues = management_client.list_queues().await?;
    let init_keys: Vec<Key> = init_queues
        .into_iter()
        .filter_map(|q| pool.parse_key(&q.name))
        .collect();

    info!("existing queues: {:?}", &init_keys);

    // start the state tracker. The state tracker is not directly related to the message queue.
    // it is kept running accross rabbitmq reconnects.
    let (sender, tracker_inbox) = mpsc::channel(100);
    let target_tracker_client = TargetTrackerClient::new(sender);
    let target_tracker_config = TargetTrackerConfig::default();
    let mut target_tracker = spawn(target_tracker_actor(
        tracker_inbox,
        init_keys,
        target_tracker_config,
    ));

    // target_tracker_client
    //     .require_worker_group(Key::new("test"), Duration::ZERO)
    //     .await?;

    let (worker_list_send, woker_list_recv) = tokio::sync::watch::channel(Arc::new(vec![]));

    tokio::spawn(api::create_server(config.api_address, woker_list_recv));

    'reconnect_loop: loop {
        // connect to rabbitmq
        let conn = Connection::connect(&config.amqp_uri, ConnectionProperties::default()).await?;

        let driver: Box<dyn WorkerDriver> = match config.worker_driver.clone() {
            WorkerDriverConfig::DockerDriver(opts) => {
                info!("Using Docker driver");
                Box::new(DockerDriver::new(opts))
            }

            WorkerDriverConfig::KubernetesDriver(opts) => {
                info!("Using Kubernetes driver");
                Box::new(KubernetesDriver::new(opts).await)
            }

            WorkerDriverConfig::Noop => {
                info!("Using Noop driver");
                Box::new(NoopDriver::new())
            }
        };

        let pool = pool.clone();
        pool.setup(&conn, &management_client).await?;
        let mut tasks = pool
            .start(
                &conn,
                &management_client,
                target_tracker_client.clone(),
                driver,
                config.worker_loop_interval,
                worker_list_send.clone(),
            )
            .await?;

        // wait for one of the jobs to complete
        select! {
            _ = signal::ctrl_c() => {
                info!("received interupt, shutting down");
                break 'reconnect_loop;
            }
            res = &mut target_tracker => {
                if let Err(err) = res {
                    error!("target tracker stopped with an error, shutting down: {:?}", err);
                } else {
                    error!("target tracker unexpectedly stopped");
                }
                break 'reconnect_loop;
            }
            _ = tasks.join_next() => {
                error!("one of the tasks stopped, reconnecting");
            },
        }

        // stop workers. shutdown is not graceful, as the system is expected
        // to be capable to handle interuptions and network partitions at any time.
        // tasks.shutdown().await;

        // TODO: don't retry in a tight loop, log something
    }

    info!("stopping the target tracker");
    target_tracker_client.stop().await?;
    target_tracker.await?;
    Ok::<(), anyhow::Error>(())
}
