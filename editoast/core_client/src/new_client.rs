use crate::CoreClient;
use crate::CoreResponse;
use crate::Error;
use crate::Headers;
use crate::WorkerKey;
use crate::mocking;
use futures::Stream;
use futures::StreamExt as _;
use futures::future::Either;
use futures::stream;
use itertools::Itertools as _;
use serde::Serialize;
use std::collections::HashSet;
use std::pin::pin;
use std::sync::Arc;
use std::time::Duration;
use tracing::trace;

#[derive(Debug, Clone)]
pub struct NewClient {
    pub client: Arc<CoreClient>,
    pub feature_flags: HashSet<String>,
}

impl NewClient {
    #[tracing::instrument(
        target = "editoast::coreclient",
        name = "core:fetch",
        skip(self, body),
        err
    )]
    pub async fn fetch<B, R>(
        &self,
        path: &str,
        body: Option<&B>,
        worker_key: WorkerKey,
        override_timeout: Option<Duration>,
        core_headers: Headers,
    ) -> Result<R::Response, Error>
    where
        B: Serialize,
        R: CoreResponse,
        <R as CoreResponse>::Response: std::marker::Send,
    {
        match self.client.as_ref() {
            CoreClient::MessageQueue(_) => {
                let stream = self
                    .fetch_streaming::<B, R>(path, body, worker_key, override_timeout, core_headers)
                    .await?;

                pin!(stream)
                    .next()
                    .await
                    .ok_or(Error::UnparsableErrorOutput)?
            }

            CoreClient::Mocked(client) => match client.fetch_mocked::<_, B, R>(path, body) {
                Ok(Some(response)) => Ok(response),
                Ok(None) => Err(Error::NoResponseContent),
                Err(mocking::MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
            },
        }
    }

    #[tracing::instrument(
        target = "editoast::coreclient",
        name = "core:fetch_streaming",
        skip(self, body),
        err
    )]
    pub async fn fetch_streaming<B, R>(
        &self,
        path: &str,
        body: Option<&B>,
        worker_key: WorkerKey,
        override_timeout: Option<Duration>,
        mut core_headers: Headers,
    ) -> Result<impl Stream<Item = Result<<R as CoreResponse>::Response, Error>>, Error>
    where
        B: Serialize,
        R: CoreResponse,
        <R as CoreResponse>::Response: std::marker::Send,
    {
        trace!(
            target: "editoast::coreclient",
            body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default(),
            "Request content");

        match self.client.as_ref() {
            CoreClient::MessageQueue(client) => {
                // TODO: maybe implement retry?
                // TODO: tracing: use correlation id
                core_headers.insert("feature_flags".into(), self.feature_flags.iter().join(", "));
                let stream = client
                    .call_with_multiple_responses(
                        worker_key.to_string(),
                        path,
                        body,
                        true,
                        override_timeout,
                        core_headers,
                    )
                    .await
                    .map_err(Error::MqClient)?;

                let owned_path = path.to_string();

                Ok(Either::Left(stream.map(move |result| {
                    let response = result.map_err(Error::MqClient)?;

                    if response.status == b"ok" {
                        return R::from_bytes(&response.payload);
                    }

                    if response.status == b"core_error" {
                        return Err(Error::parse(&response.payload, owned_path.clone()));
                    }

                    todo!("TODO: handle protocol errors")
                })))
            }
            CoreClient::Mocked(client) => {
                match client.fetch_streaming_mocked::<_, B, R>(path, body) {
                    Ok(responses) => Ok(Either::Right(stream::iter(responses).map(Ok))),
                    Err(mocking::MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
                }
            }
        }
    }
}
