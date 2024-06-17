use std::time::Duration;

use tokio::sync::{watch, oneshot, mpsc};
use crate::Key;

use super::{ActorMessage, GenerationId, TargetUpdate};


#[derive(Clone)]
pub struct TargetTrackerClient {
    outbox: mpsc::Sender<ActorMessage>,
}

pub type ActorResult<T> = Result<T, oneshot::error::RecvError>;

impl TargetTrackerClient {
    pub fn new(sender: mpsc::Sender<ActorMessage>) -> Self {
        Self { outbox: sender }
    }

    pub async fn require_worker_group(&self, wg: Key, extra_lifetime: Duration) -> ActorResult<GenerationId> {
        let (tx, rx) = oneshot::channel();
        self.outbox.send(ActorMessage::RequireQueue { key: wg, extra_lifetime, respond_to: tx }).await.unwrap();
        rx.await
    }

    pub async fn subscribe(&self) -> ActorResult<watch::Receiver<TargetUpdate>> {
        let (tx, rx) = oneshot::channel();
        self.outbox.send(ActorMessage::Subscribe { respond_to: tx }).await.unwrap();
        rx.await
    }

    pub async fn stop(&self) -> ActorResult<GenerationId> {
        let (tx, rx) = oneshot::channel();
        self.outbox.send(ActorMessage::Stop { respond_to: tx }).await.unwrap();
        rx.await
    }
}
