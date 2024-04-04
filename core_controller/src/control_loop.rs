use crate::config;
use crate::drivers::{
    core_driver::{CoreDriver, CoreMetadata},
    docker::DockerDriver,
    kubernetes::KubernetesDriver,
    mq::{Queue, RabbitMQDriver},
};
use std::fmt::Debug;
use std::{
    fmt::{self, Formatter},
    process,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{error, info, warn};

pub struct ControlLoop {
    pub config: config::Config,
    pub should_continue: Arc<AtomicBool>,
    pub known_cores: Arc<Mutex<Vec<CoreMetadata>>>,

    core_driver: Box<dyn CoreDriver>,
    mq_driver: RabbitMQDriver,
    redis_client: redis::Client,
}

impl Debug for ControlLoop {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "ControlLoop (exiting: {})",
            !self.should_continue.load(Ordering::Relaxed)
        )
    }
}

impl ControlLoop {
    /// Create a new control loop
    pub async fn new(
        config: config::Config,
        known_cores: Arc<Mutex<Vec<CoreMetadata>>>,
    ) -> ControlLoop {
        ControlLoop {
            config: config.clone(),
            core_driver: match config.provider {
                config::Provider::Docker(options) => {
                    info!("Using Docker driver");
                    Box::new(DockerDriver::new(options))
                }
                config::Provider::Kubernetes(options) => {
                    info!("Using Kubernetes driver");
                    Box::new(KubernetesDriver::new(options).await)
                }
            },
            mq_driver: RabbitMQDriver::new(config.rabbitmq),
            redis_client: redis::Client::open(config.redis.url)
                .expect("Failed to open redis connection"),
            should_continue: Arc::new(AtomicBool::new(true)),
            known_cores: known_cores.clone(),
        }
    }

    /// Remove stale cores
    #[tracing::instrument(skip_all)]
    async fn remove_stale_cores(
        &self,
        cores: Vec<CoreMetadata>,
    ) -> Result<Vec<CoreMetadata>, Box<dyn std::error::Error>> {
        // Connect to redis
        let mut redis_conn = match self.redis_client.get_multiplexed_tokio_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                warn!("Failed to connect to redis, {}", e);
                return Err("error connecting to redis".into());
            }
        };

        let mut remaining_cores: Vec<CoreMetadata> = vec![];

        // For each core, check when the last message was seen on redis and if it is older than the timeout, delete the core and its queue
        for core in cores {
            let last_seen: Option<i64> = redis::cmd("GET")
                .arg(format!(
                    "{}/{}",
                    &self.config.redis.core_last_seen_prefix, core.infra_id
                ))
                .query_async(&mut redis_conn)
                .await
                .unwrap_or(None);

            if let Some(last_seen) = last_seen {
                let now = chrono::Utc::now().timestamp();
                let diff = now - last_seen;

                if diff > self.config.core_timeout {
                    info!(
                        "Core pool for infra_id: {} has timed out, deleting it",
                        core.infra_id
                    );

                    // Delete the core pool
                    if let Err(e) = &self.core_driver.destroy_core_pool(core.infra_id).await {
                        warn!("Failed to delete core pool for infra_id, error: {}", e);
                        return Err("Failed to delete core pool".into());
                    } else {
                        info!("Deleted core pool for infra_id: {}", core.infra_id);
                    }

                    // Deleting the queue
                    if let Err(e) = &self.mq_driver.delete_queue(core.infra_id).await {
                        warn!(
                            "Failed to delete queue for infra_id: {}, error: {}",
                            core.infra_id, e
                        );
                        return Err("Failed to delete queue".into());
                    } else {
                        info!("Deleted queue for infra_id: {}", core.infra_id);
                    }

                    // Remove the redis key
                    if let Err(e) = redis::cmd("DEL")
                        .arg(format!(
                            "{}/{}",
                            &self.config.redis.core_last_seen_prefix, core.infra_id
                        ))
                        .query_async::<_, i64>(&mut redis_conn)
                        .await
                    {
                        warn!("Failed to delete redis key, error: {}", e);
                        return Err("Failed to delete redis key".into());
                    } else {
                        info!("Deleted redis key for infra_id: {}", core.infra_id);
                    }
                }
            } else {
                remaining_cores.push(core);
            }
        }

        Ok(remaining_cores)
    }

    /// For each queue, check if there is a core pool running for it, if not, start one
    #[tracing::instrument(skip_all)]
    async fn start_missing_cores(
        &self,
        remaining_cores: Vec<CoreMetadata>,
        queues: Vec<Queue>,
    ) -> Result<(), &str> {
        // Check if there are any cores that are not started
        for queue in queues {
            let found = remaining_cores
                .iter()
                .any(|core| core.infra_id == queue.infra_id);

            if !found {
                info!(
                    "No core pool not found for infra_id: {}, creating it",
                    queue.infra_id
                );

                if let Err(_) = &self
                    .core_driver
                    .get_or_create_core_pool(queue.infra_id)
                    .await
                {
                    warn!("Failed to start core pool for infra_id: {}", queue.infra_id);
                    return Err("Failed to start core pool");
                } else {
                    info!("started core pool for infra_id: {}", queue.infra_id);
                }
            }
        }

        Ok(())
    }

    /// Run the control loop
    #[tracing::instrument(name = "control_loop", skip_all)]
    pub async fn run(&self) {
        const MAX_ERROR_COUNT: u8 = 3;
        let mut error_counter: u8 = 0;

        info!("Starting");
        while self.should_continue.load(Ordering::Relaxed) {
            // If we have too many errors, exit with an error code
            if error_counter >= MAX_ERROR_COUNT {
                error!("Exiting due to repeated failures");
                process::exit(1);
            }

            // Get the list of cores from the core driver
            let cores = match self.core_driver.list_core_pools().await {
                Ok(cores) => cores,
                Err(_) => {
                    error_counter += 1;
                    warn!(
                        "Failed to list cores, error count: {}/{}",
                        error_counter, MAX_ERROR_COUNT
                    );
                    sleep(Duration::from_secs(self.config.loop_interval)).await;
                    continue;
                }
            };

            // Remove stale cores (cores that have not received a message in a while)
            let remaining_cores = match self.remove_stale_cores(cores).await {
                Ok(cores) => cores,
                Err(e) => {
                    error_counter += 1;
                    warn!(
                        "Failed to remove stale cores, error count: {}/{}, error: {}",
                        error_counter, MAX_ERROR_COUNT, e
                    );
                    sleep(Duration::from_secs(self.config.loop_interval)).await;
                    continue;
                }
            };

            // Store the remaining cores in the known_cores
            let mut latest_known_cores = self.known_cores.lock().await;
            *latest_known_cores = remaining_cores.clone();
            drop(latest_known_cores);

            // Get the list of queues
            let queues = match self.mq_driver.list_core_queues().await {
                Ok(queues) => queues,
                Err(e) => {
                    error_counter += 1;
                    warn!(
                        "Failed to list queues, error count: {}/{}. error: {}",
                        error_counter, MAX_ERROR_COUNT, e
                    );
                    sleep(Duration::from_secs(self.config.loop_interval)).await;
                    continue;
                }
            };

            // Start missing cores
            if let Err(_) = self.start_missing_cores(remaining_cores, queues).await {
                error_counter += 1;
                warn!(
                    "Failed to start missing cores, error count: {}/{}",
                    error_counter, MAX_ERROR_COUNT
                );
                sleep(Duration::from_secs(self.config.loop_interval)).await;
                continue;
            }

            // Reset the error counter
            error_counter = 0;

            // Sleep for a while
            sleep(std::time::Duration::from_secs(self.config.loop_interval)).await;
        }
    }
}
