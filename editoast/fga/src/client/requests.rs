use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::collections::HashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::Weak;
use std::time::Duration;

use futures::FutureExt as _;
use futures::StreamExt as _;
use futures::stream::FuturesUnordered;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use crate::Client;
use crate::client::BATCH_STALLING_DURATION;
use crate::client::Consistency;
use crate::client::Error;
use crate::client::api;

/// The return type of [`Client::post_stores_batch_check`] (low-level `api` function)
pub(super) type BatchCheckResult =
    Result<HashMap<String, api::queries::BatchCheckSingleResult>, Error>;

pub(super) enum RequestMessage {
    CheckBatch(ConcatenableCheckBatch, oneshot::Sender<BatchCheckResult>),
    Other(
        Box<reqwest::Request>,
        oneshot::Sender<reqwest::Result<reqwest::Response>>,
    ),
}

/// A batch of checks scheduled to be sent to OpenFGA.
///
/// [`ConcatenableCheckBatch`] can be concatenated in order to fully fill batches
/// to limit the number of requests sent to OpenFGA.
pub(super) struct ConcatenableCheckBatch {
    pub(super) checks: Vec<api::queries::BatchCheckItem>,
    pub(super) consistency: Option<Consistency>,
}

pub(super) async fn request_loop(
    client: Weak<Client>,
    semaphore: Arc<tokio::sync::Semaphore>,
    max_batch_size: usize,
    mut to_send_rx: mpsc::UnboundedReceiver<RequestMessage>,
    cancellation: CancellationToken,
) {
    let mut in_flight = FuturesUnordered::new();
    let mut delayed_batch = None::<ConcatenableCheckBatch>;
    let mut correlations = Correlations::default();
    // we could avoid the channel by wrapping correlations in an `Arc<RwLock>` but since we already
    // have a select! loop setup this is simpler
    let (batch_response_tx, mut batch_response_rx) =
        mpsc::unbounded_channel::<(BTreeSet<String>, BatchCheckResult)>();
    let stalling = tokio::time::sleep(Duration::MAX);
    tokio::pin!(stalling);

    loop {
        tokio::select! {
            _ = cancellation.cancelled() => break,
            Some(request) = to_send_rx.recv() => {
                match request {
                    RequestMessage::Other(request, response_tx) => {
                        let client = client.clone();
                        let semaphore = semaphore.clone();
                        in_flight.push(
                            async move {
                                // if we ever reach this point with the client being already dropped it doesn't matter
                                // as this loop will end soon
                                if let Some(client) = client.upgrade() {
                                    let _permit = semaphore.acquire().await.expect("semaphore should not be closed as the client is not dropped");
                                    let response = client.inner.execute(*request).await;
                                    let _ = response_tx.send(response);
                                }
                            }
                            .boxed()
                        );
                    }
                    RequestMessage::CheckBatch(batch, response_tx) => {
                        // register the checks of the original batch and the right response channel
                        correlations.push_batch(
                            batch.checks.iter().map(|c| c.correlation_id.clone()).collect(),
                            response_tx,
                        );
                        // now attempt to merge this batch with another
                        if let Some(delayed) = delayed_batch.as_mut() {
                            if let Some(overflow) = delayed.concatenate(batch, max_batch_size) {
                                let batch = delayed_batch.replace(overflow).unwrap();
                                in_flight.push(send_batch(&client, &semaphore, &batch_response_tx, batch));
                                stalling.as_mut().reset(tokio::time::Instant::now() + BATCH_STALLING_DURATION);
                            }
                            // else { batch is not full, let's wait for more checks or for the timer to ring }
                        } else {
                            delayed_batch = Some(batch);
                            stalling.as_mut().reset(tokio::time::Instant::now() + BATCH_STALLING_DURATION);
                        }
                    }
                }
            },
            _ = &mut stalling => {
                if let Some(batch) = delayed_batch.take() {
                    in_flight.push(send_batch(&client, &semaphore, &batch_response_tx, batch));
                }
            }
            Some(openfga_batch_check_response) = batch_response_rx.recv() => {
                correlations.correlate_response(openfga_batch_check_response);
            }
            Some(_) = in_flight.next() => {}
        }
    }
}

fn send_batch(
    client: &Weak<Client>,
    semaphore: &Arc<tokio::sync::Semaphore>,
    tx: &mpsc::UnboundedSender<(BTreeSet<String>, BatchCheckResult)>,
    batch: ConcatenableCheckBatch,
) -> futures::future::BoxFuture<'static, ()> {
    let client = client.clone();
    let semaphore = semaphore.clone();
    let tx = tx.clone();
    async move {
        // if we ever reach this point with the client being already dropped it doesn't matter
        // as this loop will end soon
        if let Some(client) = client.upgrade() {
            let _permit = semaphore
                .acquire()
                .await
                .expect("semaphore should never be closed");
            let keys_and_openfga_response = batch.fetch(client).await;
            // send it back to the loop to be correlated with the original request
            let _ = tx.send(keys_and_openfga_response);
        }
    }
    .boxed()
}

impl ConcatenableCheckBatch {
    /// Incorporates `other` into `self`, merging their checks and consistency levels.
    ///
    /// `self` is not allowed to be larger than `max_size` after merging it with `other`.
    /// If some checks from `other` could not be merged, they are returned.
    fn concatenate(&mut self, mut other: Self, max_size: usize) -> Option<Self> {
        let it = other
            .checks
            .drain(other.checks.len().saturating_sub(max_size)..);
        self.checks.extend(it);
        debug_assert!(self.checks.len() <= max_size);

        // makes sure we don't introduce a loss of consistency while merging two batches
        match (self.consistency, other.consistency) {
            (Some(c), Some(d)) => self.consistency = Some(c.max(d)),
            (None, Some(c)) => self.consistency = Some(c),
            _ => {}
        }

        if !other.checks.is_empty() {
            Some(other)
        } else {
            None
        }
    }

    /// Sends the request to OpenFGA and returns the response along with the expected correlation IDs.
    async fn fetch(self, client: Arc<Client>) -> (BTreeSet<String>, BatchCheckResult) {
        let response = client
            .post_stores_batch_check(
                &client.store().id,
                &self.checks,
                client.authorization_model_id().as_deref(),
                self.consistency,
            )
            .await;
        (
            self.checks.into_iter().map(|c| c.correlation_id).collect(),
            response,
        )
    }
}

#[derive(Debug, Default)]
struct Correlations {
    /// Key -> batch index
    ///
    /// size: n batches * m_i checks per batch
    key_batch: BTreeMap<String, usize>,
    /// Batch index -> batch size
    ///
    /// size: n batches
    remaining_count: VecDeque<usize>,
    /// Batch index -> reconstructed OpenFGA response
    ///
    /// size: n batches
    batch_result: VecDeque<Option<BatchCheckResult>>,
    /// Batch index -> response channel
    ///
    /// size: n batches
    tx: VecDeque<oneshot::Sender<BatchCheckResult>>,
}

impl Correlations {
    /// Sets the response channel for a batch of checks.
    fn push_batch(&mut self, keys: Vec<String>, tx: oneshot::Sender<BatchCheckResult>) {
        let batch_index = self.batch_result.len();
        self.batch_result.push_back(None);
        self.tx.push_back(tx);
        self.remaining_count.push_back(keys.len());
        self.key_batch
            .extend(keys.into_iter().zip(std::iter::repeat(batch_index)));
    }

    /// Update the state with the provided response from OpenFGA.
    ///
    /// Tries to associate each response correlation key with the expectations provided
    /// through [`Self::push_batch`].
    ///
    /// Original batches can be split into multiple actual `/batch_check` requests. We wait
    /// until all checks have been received before considering the original batch complete.
    /// When the batch is complete, the response is sent to the channel that's been set
    /// up by [`Self::push_batch`].
    ///
    /// [`Correlations`] acts like a queue of batches. Even if the second batch is complete,
    /// as long as the first batch is not yet complete, it will be kept in the queue.
    /// This won't be an issue in practice since OpenFGA responses will very likely be received
    /// in the order they were sent. That's because each request is stalled for a few milliseconds
    /// in order to allow concurrent batches to be concatenated together. So each concatenated batch
    /// request is sent with a small head start compared to the next batch.
    fn correlate_response(
        &mut self,
        (mut expected_keys, concatenated_response): (BTreeSet<String>, BatchCheckResult),
    ) {
        match concatenated_response {
            Ok(mut response) => {
                for (key, result) in response.drain() {
                    if !expected_keys.remove(&key) {
                        tracing::warn!(
                            key,
                            "OpenFGA response contains an unexpected correlation key"
                        );
                        continue;
                    }
                    let Some(batch_index) = self.key_batch.remove(&key) else {
                        panic!("no index for key: {key}");
                    };
                    if let Ok(checks) = self.batch_result[batch_index]
                        .get_or_insert_with(|| Ok(HashMap::new()))
                        .as_mut()
                    {
                        checks.insert(key, result);
                        self.remaining_count[batch_index] -= 1;
                    }
                    // else { the batch is in error, leave it like so }
                }
                if !expected_keys.is_empty() {
                    tracing::error!(
                        ?expected_keys,
                        "expected correlation keys missing from OpenFGA response"
                    );
                    panic!("missing some OpenFGA correlation keys");
                }
            }
            Err(err) => {
                for key in expected_keys {
                    let Some(batch_index) = self.key_batch.remove(&key) else {
                        panic!("no index for key: {key}");
                    };
                    self.batch_result[batch_index] = Some(Err(err.clone())); // override potential partial success
                    self.remaining_count[batch_index] = 0;
                }
            }
        }
        while self.pop_and_send_batch_if_full() {
            continue;
        }
    }

    fn pop_and_send_batch_if_full(&mut self) -> bool {
        if !self.remaining_count.is_empty() && self.remaining_count[0] == 0 {
            let _ = self.remaining_count.pop_front();
            let result = self
                .batch_result
                .pop_front()
                .unwrap()
                .expect("response should be set");
            let tx = self.tx.pop_front().unwrap();
            let _ = tx.send(result);
            true
        } else {
            false
        }
    }
}
