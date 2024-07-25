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
                    // opentelemetry_semantic_conventions::trace::DB_SYSTEM
                    "db.system" = "postgresql",
                    // opentelemetry_semantic_conventions::trace::NETWORK_PEER_ADDRESS
                    "network.peer.address" = tracing::field::display(url.host().unwrap()),
                    // opentelemetry_semantic_conventions::trace::NETWORK_PEER_PORT
                    "network.peer.port" = tracing::field::display(url.port().unwrap()),
                    // opentelemetry_semantic_conventions::trace::ERROR_TYPE
                    "error.type" = tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::debug!("establishing a connection");
                }
                self.connection_span = span;
            }
            InstrumentationEvent::FinishEstablishConnection { error, .. } => {
                {
                    let _guard = self.connection_span.enter();
                    if let Some(error) = error {
                        self.connection_span.record(
                            opentelemetry_semantic_conventions::trace::ERROR_TYPE,
                            tracing::field::debug(error),
                        );
                        tracing::warn!("failed to establish a connection");
                    } else {
                        tracing::debug!("connection established");
                    }
                }
                self.connection_span = tracing::Span::none();
            }
            InstrumentationEvent::StartQuery { query, .. } => {
                let span = tracing::info_span!(
                    "query",
                    // opentelemetry_semantic_conventions::trace::DB_STATEMENT
                    "db.statement" = tracing::field::display(query),
                    // opentelemetry_semantic_conventions::trace::ERROR_TYPE
                    "error.type" = tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::debug!("starting query");
                }
                if let Some(_existing_span) = self.query_spans.take() {
                    tracing::warn!("a query was already started: are you pipelining queries on the same connection?");
                }
                self.query_spans = Some(span);
            }
            InstrumentationEvent::CacheQuery { .. } => {
                tracing::debug!("caching query");
            }
            InstrumentationEvent::FinishQuery { query, error, .. } => {
                let span = self
                    .query_spans
                    .take()
                    .expect("a query has to be started before finishing");
                let _guard = span.enter();
                span.record(
                    opentelemetry_semantic_conventions::trace::DB_STATEMENT,
                    tracing::field::display(query),
                );
                if let Some(error) = error {
                    span.record(
                        opentelemetry_semantic_conventions::trace::ERROR_TYPE,
                        tracing::field::debug(error),
                    );
                    tracing::warn!("failed to execute the query");
                } else {
                    tracing::debug!("query finished");
                }
            }
            InstrumentationEvent::BeginTransaction { depth, .. } => {
                let span = tracing::info_span!(
                    "transaction",
                    // opentelemetry_semantic_conventions::trace::DB_OPERATION,
                    "db.operation" = "create_transaction",
                    "db.transaction.depth" = depth,
                    // opentelemetry_semantic_conventions::trace::ERROR_TYPE
                    "error.type" = tracing::field::Empty,
                );
                {
                    let _guard = span.enter();
                    tracing::debug!("beginning transaction");
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
                    opentelemetry_semantic_conventions::trace::DB_OPERATION,
                    "commit_transaction",
                );
                tracing::debug!("committing transaction");
            }
            InstrumentationEvent::RollbackTransaction { depth, .. } => {
                debug_assert_eq!(self.transaction_spans.len(), depth.get() as usize);
                let span = self
                    .transaction_spans
                    .pop_back()
                    .expect("a transaction has necessary began first");
                let _guard = span.enter();
                span.record(
                    opentelemetry_semantic_conventions::trace::DB_OPERATION,
                    "rollback_transaction",
                );
                tracing::debug!("rollbacking transaction");
            }
            _ => {
                tracing::warn!("unknown instrumentation event, maybe 'InstrumentationEvent' evolved since last time this code was updated?");
            }
        }
    }
}
