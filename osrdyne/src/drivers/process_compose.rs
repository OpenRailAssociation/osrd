//! A driver to manage workers using [process-compose](https://github.com/F1bonacc1/process-compose) REST API.
//!
//! # DISCLAIMER
//!
//! THIS DRIVER IS INTENDED FOR DEVELOPMENT PURPOSES ONLY. IT WILL NOT WORK IN PRODUCTION AND IS EXPECTED
//! TO BREAK. USE AT YOUR OWN RISK.
//!
//! Multiple process-compose instances are not supported.
//!
//! # Implementation details
//!
//! ## Spawning workers
//!
//! `process-compose` configuration is read at startup and cannot be modified while `process-compose` is running.
//! This has several unfortunate consequences on how the driver works, especially on the scaling part. Indeed,
//! we cant just edit the YAML in the driver as there's no way to reload the configuration.
//!
//! process-compose allows a process to be scaled (`sh$ process-compose process scale <process> <count>`). However,
//! we cannot set the configuration of a replicated process. Each one of them has to follow the configuration defined
//! in `process-compose.yaml`. **Including environment variables**. This is particularly problematic for the driver
//! which has to set a different WORKER_{ID,KEY,AMQP_URI} for each process.
//!
//! We overcome this by reading the values of the WORKER_* variables from tmp files when the process start. These files
//! are written by the driver just before a process starts.
//!
//! ## Identifying workers
//!
//! Unlike Docker or Kube, process-compose doesn't let us tag each process individually. We have to store in the driver
//! a mapping {PID => (Key, Uuid)} to keep track of which process is assigned to which worker key.
//!
//! ## Dealing with `process-compose process scale` behaviour
//!
//! process-compose scaling may rename the process being scale. For example, if when starting PC whe have:
//!
//! ```
//! core
//! editoast
//! front
//! # ...
//! ```
//!
//! and we scale `core` to 3 (`process-compose process scale core 3`), we will have:
//!
//! ```
//! core-0
//! core-1
//! core-2
//! editoast
//! front
//! ```
//!
//! Note how the original `core` process is now named `core-0`.
//! Now, if we want to scale even more, `process-compose process scale core 5`, we will fail since `core` doesn't exist anymore.
//! We have to run `process-compose process scale core-0 5` instead.
//!
//! The reverse applies when scaling down: `process-compose process scale core-0 1` will rename `core-0` to `core`.
//!
//! # Known limitations
//!
//! * Restarting the osrdyne process but not the other will spawn new workers for each message queue (the driver lost
//!   its internal mapping).
//! * The driver doesn't cleanup disabled or errored workers.

use std::{fmt::Debug, future::Future, pin::Pin};

use anyhow::{bail, Context};
use im::HashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Key;

use super::worker_driver::{
    DriverError, DriverError::ProcessComposeError, WorkerDriver, WorkerMetadata,
};

type Pid = u64;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PCDriverOptions {
    process: String,
    address: String,
    port: u64,
    comm_files: CommFiles,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CommFiles {
    worker_id: String,
    worker_key: String,
    amqp_uri: String,
}

pub struct PCDriver {
    options: PCDriverOptions,
    amqp_uri: String,
    workers: HashMap<Key, (ProcessInfo, Uuid)>,
    /// A lock on the files from which are read the worker environment variables.
    /// Prevents races when spawning multiple workers rapidly (eg. when osrdyne is rescheduled).
    spawn_lock: tokio::sync::Mutex<()>,
    pc: PCClient,
}

impl WorkerDriver for PCDriver {
    fn get_or_create_worker_group(
        &mut self,
        _queue_name: String,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>> {
        Box::pin(async move {
            if let Some((_, id)) = self.workers.get(&worker_key) {
                return Ok(*id);
            }

            self.start_worker(worker_key.clone())
                .await
                .map_err(ProcessComposeError)?;

            Ok(self
                .workers
                .get(&worker_key)
                .expect(
                    "process should have been created or an error should have been raised before",
                )
                .1)
        })
    }

    fn destroy_worker_group(
        &mut self,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move {
            if self.workers.contains_key(&worker_key) {
                self.stop_worker(worker_key.clone())
                    .await
                    .map_err(ProcessComposeError)?;
            }
            assert!(!self.workers.contains_key(&worker_key));
            Ok(())
        })
    }

    fn list_worker_groups(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<WorkerMetadata>, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let workers = self
                .workers
                .iter()
                .map(|(key, (info, id))| (info.pid, (key, id)))
                .collect::<HashMap<_, _>>();

            Ok(self
                .pc
                .process_info()
                .await
                .map_err(ProcessComposeError)?
                .into_iter()
                .filter_map(|p| {
                    (p.name.starts_with(&self.options.process)
                        && matches!(p.status, ProcessStatus::Running))
                    .then_some(p)
                })
                .filter_map(|ProcessInfo { name, pid, .. }| {
                    let Some((key, id)) = workers.get(&pid) else {
                        log::warn!("unexpected unmanaged worker {name}:{pid}");
                        return None;
                    };
                    Some(WorkerMetadata {
                        external_id: pid.to_string(),
                        worker_id: **id,
                        worker_key: (*key).clone(),
                        metadata: Default::default(),
                    })
                })
                .collect())
        })
    }

    fn cleanup_stalled(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move { Ok(()) })
    }
}

impl PCDriver {
    pub fn new(options: PCDriverOptions, amqp_uri: String) -> Self {
        let pc = PCClient::new(options.address.clone(), options.port);
        Self {
            options,
            amqp_uri,
            workers: HashMap::new(),
            spawn_lock: Default::default(),
            pc,
        }
    }

    async fn scan_workers(&self) -> anyhow::Result<Vec<ProcessInfo>> {
        let processes = self.pc.process_info().await?;
        Ok(processes
            .into_iter()
            .filter(|p| p.name.starts_with(&self.options.process))
            .collect())
    }

    async fn start_worker(&mut self, key: Key) -> anyhow::Result<()> {
        let processes = self.scan_workers().await?;
        let pc_proc_name_id = if processes.is_empty() {
            &self.options.process
        } else {
            &processes[0].name
        };

        let id = {
            let _ = self.spawn_lock.lock().await;
            let id = Uuid::new_v4();
            let CommFiles {
                worker_id,
                worker_key,
                amqp_uri,
            } = &self.options.comm_files;
            std::fs::write(worker_id, id.to_string())?;
            std::fs::write(worker_key, key.to_string())?;
            std::fs::write(amqp_uri, self.amqp_uri.clone())?;
            self.pc
                .process_scale(pc_proc_name_id, processes.len() + 1)
                .await?;
            id
        };

        self.sync_processes(Some((key, id))).await
    }

    async fn stop_worker(&mut self, key: Key) -> anyhow::Result<()> {
        let processes = self.scan_workers().await?;
        let pc_proc_name_id = if processes.is_empty() {
            &self.options.process
        } else {
            &processes[0].name
        };

        let stop = self
            .workers
            .remove(&key)
            .expect("process to stop should exist")
            .0
            .name;
        self.pc.process_stop(&stop).await?;
        self.pc
            .process_scale(pc_proc_name_id, processes.len() - 1)
            .await?;

        self.sync_processes(None).await
    }

    async fn sync_processes(&mut self, mut new_worker: Option<(Key, Uuid)>) -> anyhow::Result<()> {
        let processes = self.scan_workers().await?;
        let mut old_state = std::mem::replace(&mut self.workers, HashMap::new())
            .into_iter()
            .map(|(key, (info, id))| (info.pid, (key, id)))
            .collect::<HashMap<_, _>>();

        for p @ ProcessInfo { pid, status, .. } in processes {
            match status {
                ProcessStatus::Disabled | ProcessStatus::Completed => continue,
                ProcessStatus::Running => {
                    if let Some((key, id)) = old_state.remove(&pid) {
                        // yup, the process is still there
                        self.workers.insert(key, (p, id));
                    } else {
                        let Some((key, id)) = new_worker.take() else {
                            log::warn!("process {pid} with status {status:?} cannot be given a worker key - was the process started manually?");
                            continue;
                        };
                        log::info!("attached worker {key} to process {}:{pid}", p.name);
                        self.workers.insert(key, (p, id));
                    }
                }
                status => {
                    log::warn!(
                        "unexpected non-running worker process {pid} with status: {status:?}"
                    );
                    continue;
                }
            }
        }

        if let Some((key, _)) = new_worker {
            bail!("worker with key={key} did not start successfully");
        }

        Ok(())
    }
}

struct PCClient {
    address: String,
    port: u64,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Deserialize)]
struct ProcessInfo {
    name: String,
    status: ProcessStatus,
    pid: Pid,
    // more fields are omitted
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PCResult<T> {
    Ok(T),
    Err { error: String },
}

impl<T> PCResult<T> {
    fn into_result(self) -> anyhow::Result<T> {
        match self {
            Self::Ok(ok) => Ok(ok),
            Self::Err { error } => bail!("process-compose error: {error}"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
enum ProcessStatus {
    Disabled,
    Foreground,
    Pending,
    Running,
    Launching,
    Launched,
    Restarting,
    Terminating,
    Completed,
    Skipped,
    Error,
}

impl PCClient {
    fn new(address: String, port: u64) -> Self {
        let client = reqwest::Client::builder().build().unwrap();
        Self {
            address,
            port,
            client,
        }
    }

    fn url(&self, route: &str) -> String {
        format!("http://{}:{}/{}", self.address, self.port, route)
    }

    async fn process_info(&self) -> anyhow::Result<Vec<ProcessInfo>> {
        #[derive(Deserialize)]
        struct Data {
            data: Vec<ProcessInfo>,
        }

        self.client
            .get(self.url("processes"))
            .send()
            .await
            .context("could not send request to process-compose")?
            .json::<PCResult<Data>>()
            .await
            .context("could not parse response from process-compose")?
            .into_result()
            .map(|data| data.data)
    }

    async fn process_scale(&self, process: &str, count: usize) -> anyhow::Result<()> {
        log::debug!("scaling process {process} to {count}");
        self.client
            .patch(self.url(&format!("process/scale/{process}/{count}")))
            .send()
            .await
            .context("could not send request to process-compose")?
            .json::<PCResult<serde_json::Value>>()
            .await
            .context("could not parse response from process-compose")?
            .into_result()?;
        Ok(())
    }

    async fn process_stop(&self, process: &str) -> anyhow::Result<()> {
        log::info!("stopping process {process}");
        self.client
            .post(self.url(&format!("process/stop/{process}")))
            .send()
            .await
            .context("could not send request to process-compose")?
            .json::<PCResult<serde_json::Value>>()
            .await
            .context("could not parse response from process-compose")?
            .into_result()?;
        Ok(())
    }
}
