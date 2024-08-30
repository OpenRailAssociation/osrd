use lapin::Connection;
use lapin::ConnectionProperties;
use log::error;
use log::info;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;
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
        config.extra_lifetime.unwrap_or(Duration::from_secs(1)),
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

    let (worker_list_send, woker_list_recv) = tokio::sync::watch::channel(Arc::new(vec![]));

    tokio::spawn(api::create_server(config.api_address, woker_list_recv));

    'reconnect_loop: loop {
        // connect to rabbitmq
        let conn = Connection::connect(&config.amqp_uri, ConnectionProperties::default()).await?;

        let driver: Box<dyn WorkerDriver> = match config.worker_driver.clone() {
            WorkerDriverConfig::DockerDriver(opts) => {
                info!("Using Docker driver");
                Box::new(DockerDriver::new(
                    opts,
                    config.amqp_uri.clone(),
                    config.pool_id.clone(),
                ))
            }

            WorkerDriverConfig::KubernetesDriver(opts) => {
                info!("Using Kubernetes driver");
                Box::new(
                    KubernetesDriver::new(opts, config.amqp_uri.clone(), config.pool_id.clone())
                        .await,
                )
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
                info!("received interrupt, shutting down");
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
        if tokio::time::timeout(Duration::from_secs(10), tasks.shutdown())
            .await
            .is_err()
        {
            // This should never happen. If we fail to abort the task in a reasonable time,
            // the process is probably in a weird state and we should let the OS clean it up.
            panic!("failed to stop workers in time");
        }

        // TODO: don't retry in a tight loop, log something
    }

    info!("stopping the target tracker");
    target_tracker_client.stop().await?;
    target_tracker.await?;
    Ok::<(), anyhow::Error>(())
}

fn init_tracing(mode: EditoastMode, telemetry_config: &client::TelemetryConfig) {
    let env_filter_layer = tracing_subscriber::EnvFilter::builder()
        // Set the default log level to 'info'
        .with_default_directive(tracing_subscriber::filter::LevelFilter::INFO.into())
        .from_env_lossy();
    let fmt_layer = tracing_subscriber::fmt::layer()
        .pretty()
        .with_file(true)
        .with_line_number(false)
        .boxed();
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/layer/index.html#runtime-configuration-with-layers
    let telemetry_layer = match telemetry_config.telemetry_kind {
        client::TelemetryKind::None => None,
        client::TelemetryKind::Datadog => {
            let datadog_tracer = opentelemetry_datadog::new_pipeline()
                .with_service_name(telemetry_config.service_name.as_str())
                .with_agent_endpoint(telemetry_config.telemetry_endpoint.as_str())
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize datadog tracer");
            let layer = tracing_opentelemetry::layer()
                .with_tracer(datadog_tracer)
                .boxed();
            opentelemetry::global::set_text_map_propagator(DatadogPropagator::default());
            Some(layer)
        }
        client::TelemetryKind::Opentelemetry => {
            let exporter = opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(telemetry_config.telemetry_endpoint.as_str());
            let trace_config =
                opentelemetry_sdk::trace::config().with_resource(Resource::new(vec![
                    KeyValue::new(
                        opentelemetry_semantic_conventions::resource::SERVICE_NAME,
                        telemetry_config.service_name.clone(),
                    ),
                ]));
            let otlp_tracer = opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(exporter)
                .with_trace_config(trace_config)
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize Opentelemetry tracer");
            let layer = tracing_opentelemetry::layer()
                .with_tracer(otlp_tracer)
                .boxed();
            opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());
            Some(layer)
        }
    };
    tracing_subscriber::registry()
        .with(telemetry_layer)
        .with(env_filter_layer)
        .with(fmt_layer)
        .init();
}
