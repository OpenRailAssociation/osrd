use std::sync::Arc;
use std::sync::Weak;

use futures::StreamExt as _;
use futures::stream::FuturesUnordered;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use crate::Client;

pub(super) type SendMessage = (
    reqwest::Request,
    oneshot::Sender<reqwest::Result<reqwest::Response>>,
);

pub(super) async fn request_loop(
    client: Weak<Client>,
    semaphore: Arc<tokio::sync::Semaphore>,
    mut to_send_rx: mpsc::UnboundedReceiver<SendMessage>,
    cancellation: CancellationToken,
) {
    let mut in_flight = FuturesUnordered::new();
    loop {
        tokio::select! {
            _ = cancellation.cancelled() => break,
            Some((request, response_tx)) = to_send_rx.recv() => {
                let client = client.clone();
                let semaphore = semaphore.clone();
                in_flight.push(async move {
                    if let Some(client) = client.upgrade() {
                        let _permit = semaphore.acquire().await.expect("semaphore should not be closed as the client is not dropped");
                        let response = client.inner.execute(request).await;
                        let _ = response_tx.send(response);
                    }
                })
            },
            Some(_) = in_flight.next() => {}
        }
    }
}
