use actix_web::{
    body::BoxBody,
    dev::{
        self, HttpServiceFactory, ResourceDef, Service, ServiceFactory, ServiceRequest,
        ServiceResponse,
    },
    error::ParseError,
    http::{
        header::{self, HeaderMap},
        uri::Authority,
        StatusCode,
    },
    web, FromRequest, HttpRequest, HttpResponse, ResponseError,
};
use actix_web_actors::ws;
use actix_web_opentelemetry::ClientExt;
use awc::Client;
use either::Either;
use futures_util::future::LocalBoxFuture;
use log::{debug, warn};
use opentelemetry::{
    global::{self, BoxedTracer},
    trace::Tracer,
    Context,
};
use opentelemetry::{
    trace::{TraceContextExt, TracerProvider},
    KeyValue,
};
use percent_encoding::{utf8_percent_encode, AsciiSet};

use awc::error::{ConnectError, SendRequestError as AwcSendRequestError};
use futures_util::StreamExt;
use std::{collections::HashSet, net::IpAddr};
use std::{fmt, rc::Rc};
use std::{
    future::{ready, Ready},
    time::Duration,
};

use dyn_clone::DynClone;
use header_classifier::HeaderClassifier;

mod header_classifier;
mod websocket;

// re-exports
pub use actix_web::http::{
    header::{HeaderName, HeaderValue}, // for the request modifier / forwarded headers
    Uri,                               // for the upstream
};
pub use awc::{ws::WebsocketsRequest, ClientRequest}; // for the request modifier
pub use ipnet::IpNet; // for trusted proxies

pub trait RequestModifier: DynClone {
    fn modify_http_request(
        &self,
        client_request: &HttpRequest,
        back_request: &mut ClientRequest,
    ) -> Result<(), actix_web::Error>;

    fn modify_ws_request(
        &self,
        client_request: &HttpRequest,
        request: WebsocketsRequest,
    ) -> Result<WebsocketsRequest, actix_web::Error>;
}
dyn_clone::clone_trait_object!(RequestModifier);

#[derive(Clone)]
pub struct Proxy {
    mount_path: String,
    trusted_proxies: Vec<IpNet>,
    forwarded_headers: Option<Vec<HeaderName>>,
    blocked_headers: HashSet<HeaderName>,
    request_modifier: Option<Box<dyn RequestModifier + Send>>,
    upstream_scheme: String,
    upstream_authority: Authority,
    upstream_path_prefix: String,
    timeout: Option<Duration>,
    tracing_name: Option<String>,
}

/// The set of characters that have to be percent encoded in the path.
/// Actix web decodes the percent-encoded path for routing to perform as expected.
/// We thus need to re-encode everything that was decoded in the first place.
///
/// The set of characters that need to be percent-encoded can be found in the source of
/// actix_web::http::uri::PathAndQuery::from_shared
///
/// ```python
/// allowed_bytes = {0x21, *range(0x24, 0x3B + 1), 0x3D, *range(0x40, 0x5F + 1), *range(0x61, 0x7A + 1), 0x7C, 0x7E}
/// controls = {*range(0x20), 0x7F}
/// forbidden_bytes = set(range(0, 128)) - allowed_bytes - controls
/// print("".join(f".add(b{chr(e)!r})" for e in forbidden_bytes))
/// ```
const REQUIRES_PATH_ENCODING: &AsciiSet = &percent_encoding::CONTROLS
    .add(b' ')
    .add(b'`')
    .add(b'"')
    .add(b'#')
    .add(b'{')
    .add(b'<')
    .add(b'}')
    .add(b'>')
    .add(b'?');

fn get_tracer() -> BoxedTracer {
    global::tracer_provider()
        .tracer_builder("actix_proxy")
        .with_version(env!("CARGO_PKG_VERSION"))
        .with_schema_url("https://opentelemetry.io/schemas/1.17.0")
        .build()
}

impl Proxy {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        mount_path: Option<String>,
        upstream: Uri,
        trusted_proxies: Vec<IpNet>,
        forwarded_headers: Option<Vec<HeaderName>>,
        blocked_headers: HashSet<HeaderName>,
        request_modifier: Option<Box<dyn RequestModifier + Send>>,
        timeout: Option<Duration>,
        tracing_name: Option<String>,
    ) -> Self {
        let upstream_scheme = upstream.scheme_str().unwrap().to_owned();
        let upstream_authority = upstream
            .authority()
            .expect("url must have an authority")
            .clone();
        let mut upstream_path_prefix = upstream.path().to_string();
        if !upstream_path_prefix.is_empty() && !upstream_path_prefix.ends_with('/') {
            upstream_path_prefix.push('/');
        }

        Self {
            tracing_name,
            mount_path: match mount_path {
                Some(prefix) => prefix.trim_end_matches('/').to_owned(),
                None => "/".to_owned(),
            },
            upstream_scheme,
            upstream_authority,
            upstream_path_prefix,
            trusted_proxies,
            forwarded_headers,
            blocked_headers,
            request_modifier,
            timeout,
        }
    }

    fn rebase_uri(&self, new_protocol: Option<&str>, path: &str, query: &str) -> Uri {
        let scheme = new_protocol.unwrap_or(&self.upstream_scheme);

        let mut final_path = self.upstream_path_prefix.clone();
        let path = path.trim_start_matches('/');
        for c in utf8_percent_encode(path, REQUIRES_PATH_ENCODING) {
            final_path.push_str(c);
        }

        if !query.is_empty() {
            final_path.push('?');
            final_path.push_str(query);
        }

        Uri::builder()
            .scheme(scheme)
            .authority(self.upstream_authority.clone())
            .path_and_query(final_path)
            .build()
            .expect("failed to build uri")
    }
}

impl HttpServiceFactory for Proxy {
    fn register(self, config: &mut actix_web::dev::AppService) {
        let rdef = if config.is_root() {
            ResourceDef::root_prefix(&self.mount_path)
        } else {
            ResourceDef::prefix(&self.mount_path)
        };

        config.register_service(rdef, None, self, None)
    }
}

impl ServiceFactory<ServiceRequest> for Proxy {
    type Response = ServiceResponse;
    type Error = actix_web::Error;
    type Config = ();
    type Service = ProxyService;
    type InitError = ();
    type Future = Ready<Result<Self::Service, Self::InitError>>;

    fn new_service(&self, _: ()) -> Self::Future {
        let mut client = awc::Client::builder().disable_timeout();

        if let Some(timeout) = self.timeout {
            client = client.timeout(timeout);
        }

        ready(Ok(ProxyService::new(
            client.finish(),
            self.clone(),
            self.request_modifier.clone(),
        )))
    }
}

#[derive(Debug)]
pub struct SendRequestError(AwcSendRequestError);

impl fmt::Display for SendRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<AwcSendRequestError> for SendRequestError {
    fn from(e: AwcSendRequestError) -> Self {
        Self(e)
    }
}

/// Convert `SendRequestError` to a server `Response`
impl ResponseError for SendRequestError {
    fn status_code(&self) -> StatusCode {
        match self.0 {
            AwcSendRequestError::Connect(ConnectError::Timeout) => StatusCode::GATEWAY_TIMEOUT,
            AwcSendRequestError::Connect(_) => StatusCode::BAD_GATEWAY,
            AwcSendRequestError::Response(ParseError::Timeout) => StatusCode::GATEWAY_TIMEOUT,
            AwcSendRequestError::Response(_) => StatusCode::BAD_GATEWAY,
            AwcSendRequestError::Timeout => StatusCode::GATEWAY_TIMEOUT,
            // urls shouldn't ever be invalid
            AwcSendRequestError::Url(_) => StatusCode::INTERNAL_SERVER_ERROR,
            _ => StatusCode::BAD_GATEWAY,
        }
    }
}

/// Handles requests
pub struct ProxyService {
    inner: Rc<InnerProxyService>,
}

struct InnerProxyService {
    client: Client,
    proxy: Proxy,
    request_modifier: Option<Box<dyn RequestModifier + Send>>,
}

impl InnerProxyService {
    async fn handle(
        &self,
        req: &HttpRequest,
        stream: web::Payload,
        unprocessed_path: &str,
        query: &str,
        context: Context,
    ) -> Result<HttpResponse, actix_web::Error> {
        match req.headers().get(&header::UPGRADE) {
            Some(header) if header.as_bytes() == b"websocket" => {
                self.handle_websocket(req, stream, unprocessed_path, query, context)
                    .await
            }
            _ => {
                self.handle_http(req, stream, unprocessed_path, query, context)
                    .await
            }
        }
    }

    fn is_trusted_proxy(&self, ip: &std::net::IpAddr) -> bool {
        self.proxy
            .trusted_proxies
            .iter()
            .any(|trusted_proxy| trusted_proxy.contains(ip))
    }

    fn build_forwarded_for(&self, orig_header: Option<&HeaderValue>, client_ip: &IpAddr) -> String {
        let client_ip_str = client_ip.to_string();
        let Some(orig_header) = orig_header else {
            return client_ip_str;
        };

        if !self.is_trusted_proxy(client_ip) {
            return client_ip_str;
        }

        // ensure the original header only contains allowed ascii values
        let Ok(original_header_str) = orig_header.to_str() else {
            return client_ip_str;
        };

        format!("{original_header_str}, {client_ip_str}")
    }

    fn iter_forwarded_req_headers<'a>(
        &'a self,
        headers: &'a HeaderMap,
    ) -> impl Iterator<Item = (&'a HeaderName, &'a HeaderValue)> + 'a {
        if let Some(forwarded_headers) = &self.proxy.forwarded_headers {
            Either::Left(forwarded_headers.iter().filter_map(|header_name| {
                headers.get(header_name).map(|value| (header_name, value))
            }))
        } else {
            Either::Right(headers.iter())
        }
    }

    async fn handle_websocket(
        &self,
        req: &HttpRequest,
        stream: web::Payload,
        unprocessed_path: &str,
        query: &str,
        context: Context,
    ) -> Result<HttpResponse, actix_web::Error> {
        let back_uri = self.proxy.rebase_uri(Some("ws"), unprocessed_path, query);
        context
            .span()
            .set_attribute(KeyValue::new("proxy.upstream_uri", back_uri.to_string()));
        context
            .span()
            .set_attribute(KeyValue::new("proxy.type", "ws"));

        debug!("proxy: websocket - received request forwarded to {back_uri}");
        // open a websocket connection to the backend
        let mut back_request = self.client.ws(back_uri);
        // Call the callback to modify the request if it exists
        if let Some(ref modifier) = self.request_modifier {
            back_request = modifier.modify_ws_request(req, back_request)?;
        }

        {
            // forward request headers
            let header_classifier = HeaderClassifier::from_headermap(req.headers());
            for (header_name, header) in self.iter_forwarded_req_headers(req.headers()) {
                if header_classifier.forwardable(header_name)
                    && !self.proxy.blocked_headers.contains(header_name)
                {
                    back_request = back_request.header(header_name, header);
                }
            }
        }

        // set or update X-Forwarded-For
        if let Some(peer_addr) = req.peer_addr() {
            let client_ip = peer_addr.ip();
            let orig_header = req.headers().get("X-Forwarded-For");
            let new_header = self.build_forwarded_for(orig_header, &client_ip);
            back_request = back_request.header("X-Forwarded-For", new_header);
        }

        let host = req.uri().host().unwrap_or_default();
        back_request = back_request.header("X-Forwarded-Host", host);

        {
            // conn_info holds a refcell. holding a refcell accross await points
            // triggers a clippy warning
            let conn_info = req.connection_info();
            let proto = conn_info.scheme();
            back_request = back_request.header("X-Forwarded-Proto", proto);
        }

        let (back_response, back_ws) = back_request.connect().await.unwrap();

        let mut res = ws::handshake(req)?;
        {
            // forward response headers
            let header_classifier = HeaderClassifier::from_headermap(back_response.headers());
            for header in back_response.headers() {
                if header_classifier.forwardable(header.0) {
                    res.append_header(header);
                }
            }
        }
        let (back_tx, back_rx) = back_ws.split();
        Ok(res.streaming(websocket::ClientProxyActor::new_stream(
            stream, back_rx, back_tx,
        )))
    }

    async fn handle_http(
        &self,
        req: &HttpRequest,
        stream: web::Payload,
        unprocessed_path: &str,
        query: &str,
        context: Context,
    ) -> Result<HttpResponse, actix_web::Error> {
        let back_uri = self.proxy.rebase_uri(None, unprocessed_path, query);
        context
            .span()
            .set_attribute(KeyValue::new("proxy.upstream_uri", back_uri.to_string()));
        context
            .span()
            .set_attribute(KeyValue::new("proxy.type", "http"));

        debug!("proxy: http - received request forwarded to {back_uri}");
        let mut back_request = self.client.request(req.method().clone(), back_uri);
        // Call the callback to modify the request if it exists
        if let Some(ref modifier) = self.request_modifier {
            modifier.modify_http_request(req, &mut back_request)?;
        }

        {
            // forward request headers
            let header_classifier = HeaderClassifier::from_headermap(req.headers());
            for (header_name, header_value) in self.iter_forwarded_req_headers(req.headers()) {
                if header_classifier.forwardable(header_name)
                    && !self.proxy.blocked_headers.contains(header_name)
                {
                    back_request = back_request.append_header((header_name, header_value));
                }
            }
        }

        // Set or update X-Forwarded-For
        if let Some(peer_addr) = req.peer_addr() {
            let client_ip = peer_addr.ip();
            let orig_header = req.headers().get("X-Forwarded-For");
            let new_header = self.build_forwarded_for(orig_header, &client_ip);
            back_request = back_request.append_header(("X-Forwarded-For", new_header));
        }

        let host = req.uri().host().unwrap_or_default();
        back_request = back_request.append_header(("X-Forwarded-Host", host));

        {
            // conn_info holds a refcell. holding a refcell accross await points
            // triggers a clippy warning
            let conn_info = req.connection_info();
            let proto = conn_info.scheme();
            back_request = back_request.append_header(("X-Forwarded-Proto", proto));
        }

        let back_response = back_request
            .trace_request()
            .send_stream(stream)
            .await
            .map_err(SendRequestError)?;

        let mut response = HttpResponse::build(back_response.status());

        {
            // forward response headers
            let header_classifier = HeaderClassifier::from_headermap(back_response.headers());
            for response_header in back_response.headers() {
                if header_classifier.forwardable(response_header.0) {
                    response.append_header(response_header);
                }
            }
        }

        Ok(response.streaming(back_response))
    }
}

impl ProxyService {
    pub fn new(
        client: Client,
        proxy: Proxy,
        request_modifier: Option<Box<dyn RequestModifier + Send>>,
    ) -> Self {
        Self {
            inner: Rc::new(InnerProxyService {
                client,
                proxy,
                request_modifier,
            }),
        }
    }
}

impl Service<ServiceRequest> for ProxyService {
    type Response = ServiceResponse<BoxBody>;
    type Error = actix_web::Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    dev::always_ready!();

    fn call(&self, mut req: ServiceRequest) -> Self::Future {
        let proxy_service = self.inner.clone();

        Box::pin(async move {
            get_tracer()
                .in_span("Proxying request", |cx| async move {
                    // set tracing attributes
                    cx.span().set_attribute(KeyValue::new(
                        "proxy.name",
                        proxy_service
                            .proxy
                            .tracing_name
                            .clone()
                            .unwrap_or("unnamed".to_owned()),
                    ));
                    cx.span().set_attribute(KeyValue::new(
                        "proxy.mount_path",
                        proxy_service.proxy.mount_path.clone(),
                    ));

                    // forward request
                    let (http_request, payload) = req.parts_mut();
                    let unprocessed_path = http_request.match_info().unprocessed();
                    let query = http_request.query_string();
                    let stream = web::Payload::from_request(http_request, payload).await?;
                    match proxy_service
                        .handle(http_request, stream, unprocessed_path, query, cx)
                        .await
                    {
                        Ok(resp) => Ok(req.into_response(resp)),
                        Err(e) => {
                            warn!("proxy: error forwarding request: {}", e);
                            Err(e)
                        }
                    }
                })
                .await
        })
    }
}
