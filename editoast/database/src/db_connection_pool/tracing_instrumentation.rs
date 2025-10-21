use std::collections::VecDeque;

use diesel::connection::Instrumentation;
use diesel::connection::InstrumentationEvent;
use tracing::Span;
use url::Url;

#[derive(Debug)]
pub struct TracingInstrumentation {
    connection_span: Span,
    query_spans: Option<Span>,
    transaction_spans: VecDeque<Span>,
}

impl Default for TracingInstrumentation {
    fn default() -> Self {
        Self {
            connection_span: tracing::Span::none(),
            query_spans: None,
            transaction_spans: VecDeque::default(),
        }
    }
}

impl Instrumentation for TracingInstrumentation {
    fn on_connection_event(&mut self, event: InstrumentationEvent<'_>) {
        match event {
            InstrumentationEvent::StartEstablishConnection { url, .. } => {
                let url = Url::parse(url).unwrap();
                let span = tracing::trace_span!(
                    "connection",
                    { opentelemetry_semantic_conventions::attribute::DB_SYSTEM_NAME } =
                        "postgresql",
                    { opentelemetry_semantic_conventions::attribute::NETWORK_PEER_ADDRESS } =
                        tracing::field::display(url.host().unwrap()),
                    { opentelemetry_semantic_conventions::attribute::NETWORK_PEER_PORT } =
                        tracing::field::display(url.port().unwrap()),
                    { opentelemetry_semantic_conventions::attribute::ERROR_TYPE } =
                        tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::trace!("establishing a connection");
                }
                self.connection_span = span;
            }
            InstrumentationEvent::FinishEstablishConnection { error, .. } => {
                {
                    let _guard = self.connection_span.enter();
                    if let Some(error) = error {
                        self.connection_span.record(
                            opentelemetry_semantic_conventions::attribute::ERROR_TYPE,
                            tracing::field::debug(error),
                        );
                        tracing::warn!("failed to establish a connection");
                    } else {
                        tracing::trace!("connection established");
                    }
                }
                self.connection_span = tracing::Span::none();
            }
            InstrumentationEvent::StartQuery { query, .. } => {
                let span = tracing::info_span!(
                    "query",
                    { opentelemetry_semantic_conventions::attribute::DB_QUERY_TEXT } =
                        tracing::field::display(query),
                    { opentelemetry_semantic_conventions::attribute::ERROR_TYPE } =
                        tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::trace!("starting query");
                }
                if let Some(_existing_span) = self.query_spans.take() {
                    tracing::warn!(
                        "a query was already started: are you pipelining queries on the same connection?"
                    );
                }
                self.query_spans = Some(span);
            }
            InstrumentationEvent::CacheQuery { .. } => {
                tracing::trace!("caching query");
            }
            InstrumentationEvent::FinishQuery { query, error, .. } => {
                let span = self
                    .query_spans
                    .take()
                    .expect("a query has to be started before finishing");
                let _guard = span.enter();
                span.record(
                    opentelemetry_semantic_conventions::attribute::DB_QUERY_TEXT,
                    tracing::field::display(query),
                );
                if let Some(error) = error {
                    span.record(
                        opentelemetry_semantic_conventions::attribute::ERROR_TYPE,
                        tracing::field::debug(error),
                    );
                    tracing::warn!("failed to execute the query");
                } else {
                    tracing::trace!("query finished");
                }
            }
            InstrumentationEvent::BeginTransaction { depth, .. } => {
                let span = tracing::info_span!(
                    "transaction",
                    { opentelemetry_semantic_conventions::attribute::DB_OPERATION_NAME } =
                        "create_transaction",
                    "db.transaction.depth" = depth,
                    { opentelemetry_semantic_conventions::attribute::ERROR_TYPE } =
                        tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::trace!("beginning transaction");
                }
                self.transaction_spans.push_back(span);
            }
            InstrumentationEvent::CommitTransaction { depth, .. } => {
                debug_assert_eq!(self.transaction_spans.len(), depth.get() as usize);
                let span = self
                    .transaction_spans
                    .pop_back()
                    .expect("a transaction has necessary began first");
                let _guard = span.enter();
                span.record(
                    opentelemetry_semantic_conventions::attribute::DB_OPERATION_NAME,
                    "commit_transaction",
                );
                tracing::trace!("committing transaction");
            }
            InstrumentationEvent::RollbackTransaction { depth, .. } => {
                debug_assert_eq!(self.transaction_spans.len(), depth.get() as usize);
                let span = self
                    .transaction_spans
                    .pop_back()
                    .expect("a transaction has necessary began first");
                let _guard = span.enter();
                span.record(
                    opentelemetry_semantic_conventions::attribute::DB_OPERATION_NAME,
                    "rollback_transaction",
                );
                tracing::trace!("rollbacking transaction");
            }
            _ => {
                tracing::warn!(
                    "unknown instrumentation event, maybe 'InstrumentationEvent' evolved since last time this code was updated?"
                );
            }
        }
    }
}
