use tokio::sync::{mpsc, oneshot, watch};
use tokio::time::{Duration, Instant};
use tracing::trace;

use crate::Key;

use super::{GenerationId, QueueStateMap, TargetTracker};

pub struct TargetTrackerConfig {
    pub unbind_delay: Duration,
    pub delete_delay: Duration,
    pub timeout_allowance: Duration,
}

impl Default for TargetTrackerConfig {
    fn default() -> Self {
        Self {
            unbind_delay: Duration::from_secs(10 * 60),
            delete_delay: Duration::from_secs(10 * 60),
            timeout_allowance: Duration::from_secs(1),
        }
    }
}

#[derive(Debug, Clone)]
pub struct TargetUpdate {
    pub generation: GenerationId,
    pub queues: QueueStateMap,
}

#[derive(Debug)]
pub enum ActorMessage {
    RequireQueue {
        key: Key,
        extra_lifetime: Duration,
        respond_to: oneshot::Sender<GenerationId>,
    },
    Subscribe {
        respond_to: oneshot::Sender<watch::Receiver<TargetUpdate>>,
    },
    Stop {
        respond_to: oneshot::Sender<GenerationId>,
    },
}

#[derive(Debug)]
enum LoopEvent {
    ActorMessage(ActorMessage),
    Deadline(Instant),
    Stop,
}

type ActorInbox = mpsc::Receiver<ActorMessage>;

async fn next_event(
    state: &TargetTracker,
    inbox: &mut ActorInbox,
    timeout_allowance: Duration,
) -> LoopEvent {
    if let Some(deadline) = state.deadline() {
        // Add the timeout allowance to the deadline
        let deadline = deadline + timeout_allowance;

        match tokio::time::timeout_at(deadline, inbox.recv()).await {
            Ok(None) => LoopEvent::Stop,
            Ok(Some(msg)) => LoopEvent::ActorMessage(msg),
            Err(_) => LoopEvent::Deadline(deadline),
        }
    } else {
        match inbox.recv().await {
            None => LoopEvent::Stop,
            Some(msg) => LoopEvent::ActorMessage(msg),
        }
    }
}

pub async fn target_tracker_actor(
    mut inbox: ActorInbox,
    initial_state: Vec<Key>,
    config: TargetTrackerConfig,
) {
    let mut state = TargetTracker::new(
        Instant::now(),
        initial_state,
        config.unbind_delay,
        config.delete_delay,
    );
    let (stream, _) = watch::channel(TargetUpdate {
        generation: state.get_generation(),
        queues: state.get_target_state(),
    });

    let mut running = true;
    while running {
        let event = next_event(&state, &mut inbox, config.timeout_allowance).await;
        let iteration_time = Instant::now();
        let msg = match event {
            LoopEvent::Stop => break,
            LoopEvent::ActorMessage(msg) => Some(msg),
            LoopEvent::Deadline(deadline) => {
                trace!(
                    "processing message with delay {:?}",
                    iteration_time - deadline
                );
                None
            }
        };

        // process status updates
        state.evolve_until(iteration_time);

        // process the message, if any
        if let Some(msg) = msg {
            match msg {
                ActorMessage::Subscribe { respond_to } => {
                    let _ = respond_to.send(stream.subscribe());
                }
                ActorMessage::RequireQueue {
                    key,
                    extra_lifetime,
                    respond_to,
                } => {
                    state.require_queue(iteration_time, extra_lifetime, &key);
                    let _ = respond_to.send(state.get_generation());
                }
                ActorMessage::Stop { respond_to } => {
                    let _ = respond_to.send(state.get_generation());
                    running = false;
                }
            }
        }

        // send an update to subscribers
        stream.send_replace(TargetUpdate {
            generation: state.get_generation(),
            queues: state.get_target_state(),
        });
    }
}
