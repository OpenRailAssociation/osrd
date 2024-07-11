use std::collections::HashMap;
use std::sync::Arc;

use lapin::options::QueueBindOptions;
use lapin::options::QueueDeclareOptions;
use lapin::options::QueueDeleteOptions;
use lapin::types::FieldTable;
use log::debug;
use tokio::sync::watch;
use tokio::sync::oneshot;
use tokio::select;
use lapin::Channel;
use tokio::task::AbortHandle;
use tokio::task::JoinSet;

use crate::target_tracker::GenerationId;
use crate::target_tracker::QueueStatus;
use crate::target_tracker::TargetUpdate;
use crate::Key;
use crate::Pool;


#[derive(Debug)]
pub struct QueuesState {
    pub target_generation: GenerationId,
    pub queues: im::OrdMap<Key, QueueStatus>,
}

pub async fn queues_control_loop(
    pool: Arc<Pool>,
    chan: Channel,
    initial_keys: Vec<Key>,
    mut expected_state: watch::Receiver<TargetUpdate>,
    res: oneshot::Sender<watch::Receiver<QueuesState>>
) {
    let chan = Arc::new(chan);

    // a set of currently running jobs
    let mut jobs = JoinSet::new();
    let mut jobs_by_key = HashMap::<Key, AbortHandle>::new();

    let mut init_state = im::OrdMap::new();

    // get the initial target queue state
    let mut target = expected_state.borrow_and_update().clone();

    for queue in initial_keys.into_iter() {
        // at startup, assume all queues are unbound
        init_state.insert(queue.clone(), QueueStatus::Unbound);

        // remove queues which aren't supposed to be there
        if !target.queues.contains_key(&queue) {
            let job = jobs.spawn(update_queue(pool.clone(), chan.clone(), queue.clone(), None));
            jobs_by_key.insert(queue, job);
        }
    }

    // set all queues to the target state
    for (queue, queue_status) in target.queues.iter() {
        let job = jobs.spawn(update_queue(pool.clone(), chan.clone(), queue.clone(), Some(*queue_status)));
        jobs_by_key.insert(queue.clone(), job);
    }

    // send back the initial state
    let (tx, rx) = watch::channel(
        QueuesState {
            target_generation: target.generation,
            queues: init_state,
        }
    );
    let _ = res.send(rx);

    // two concurrent events can happen:
    //  - a new target state can arrive:
    //    - start new update jobs, cancelling conflicting ones if necessary
    //  - a job can complete:
    //    - update the current reported state

    'outer: loop {
        select! {
            // update the reported state on job completion
            Some(job_completion) = jobs.join_next(), if !jobs.is_empty() => {
                // TODO: don't assume the join goes well
                let job_completion = job_completion.unwrap();
                // TODO: proper error handling on job failure (disconnect, non empty queue)
                let (job_key, new_status) = job_completion.unwrap();
                debug!("queue update job completed: {:?} to {:?}", &job_key, new_status);
                jobs_by_key.remove(&job_key);
                tx.send_modify(|state| {
                    if let Some(new_status) = new_status {
                        state.queues.insert(job_key, new_status);
                    } else {
                        state.queues.remove(&job_key);
                    }
                });
            }

            // a new target state arrived
            changed = expected_state.changed() => {
                // stop if the sender was dropped
                if let Err(_) = changed {
                    break 'outer;
                }

                // make a copy to avoid holding the lock
                let new_target = {
                    let new_target = expected_state.borrow_and_update();
                    new_target.clone()
                };

                // apply each change
                for change in target.queues.diff(&new_target.queues) {
                    let (key, new_status) = match change {
                        im::ordmap::DiffItem::Add(key, status) => (key, Some(*status)),
                        im::ordmap::DiffItem::Update { old, new } => (old.0, Some(*new.1)),
                        im::ordmap::DiffItem::Remove(old_key, _) => (old_key, None),
                    };

                    // TODO: I'm not confident that cancelling the previous job guarantees the absence of race
                    let job = jobs.spawn(update_queue(pool.clone(), chan.clone(), key.clone(), new_status));
                    if let Some(previous_job) = jobs_by_key.insert(key.clone(), job) {
                        previous_job.abort()
                    }
                }

                target = new_target;
                tx.send_modify(|state| {
                    state.target_generation = target.generation;
                });
            }
        }
    }
}


#[derive(Debug)]
enum QueueUpdateError {
    QueueNotEmpty(Key),
    LapinError(lapin::Error),
}

impl From<lapin::Error> for QueueUpdateError {
    fn from(value: lapin::Error) -> Self {
        Self::LapinError(value)
    }
}

async fn update_queue(pool: Arc<Pool>, chan: Arc<Channel>, key: Key, new_state: Option<QueueStatus>) -> Result<(Key, Option<QueueStatus>), QueueUpdateError> {
    let queue_name = pool.key_queue_name(&key);
    match new_state {
        Some(QueueStatus::Active) => {
            debug!("declaring and binding queue {:?}", &key);
            chan.queue_declare(&queue_name, QueueDeclareOptions::default(), FieldTable::default()).await?;
            chan.queue_bind(&queue_name, &pool.request_xchg, &key.encode(), QueueBindOptions::default(), FieldTable::default()).await?;
        },
        Some(QueueStatus::Unbound) => {
            debug!("declaring and unbinding queue {:?}", &key);
            chan.queue_declare(&queue_name, QueueDeclareOptions::default(), FieldTable::default()).await?;
            chan.queue_unbind(&queue_name, &pool.request_xchg, &key.encode(), FieldTable::default()).await?;
        },
        None => {
            debug!("deleting queue {:?}", &key);
            chan.queue_unbind(&queue_name, &pool.request_xchg, &key.encode(), FieldTable::default()).await?;
            match chan.queue_delete(&queue_name, QueueDeleteOptions {
                if_empty: true,
                ..Default::default()
            }).await {
                Err(lapin::Error::ProtocolError(err)) => {
                    debug!("got protocol error (assuming non empty queue): {:?}", err);
                    return Err(QueueUpdateError::QueueNotEmpty(key));
                },
                res => res?,
            };
        },
    }
    Ok((key, new_state))
}
