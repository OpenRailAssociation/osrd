use actix_web::http::{header, StatusCode, Uri};
use actix_web::{
    middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer, ResponseError,
};

use actix_web_actors::ws;
use awc::error::{ConnectError, SendRequestError as AwcSendRequestError};
use awc::Client;
use futures_util::StreamExt;
use log::{debug, error, info, warn};
use std::fmt;

mod proxy_config;
mod websocket_proxy;

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
///
impl ResponseError for SendRequestError {
    fn status_code(&self) -> StatusCode {
        match self.0 {
            AwcSendRequestError::Connect(ConnectError::Timeout) => StatusCode::GATEWAY_TIMEOUT,
            AwcSendRequestError::Connect(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

fn is_hop_by_hop(header: &str) -> bool {
    // TODO: parse connection header, which contains a comma
    // separated list of additional hop-by-hop headers
    match header {
        "keep-alive" => true,
        "transfer-encoding" => true,
        "te" => true,
        "connection" => true,
        "trailer" => true,
        "upgrade" => true,
        "proxy-authorization" => true,
        "proxy-authenticate" => true,
        "sec-websocket-key" => true,
        "sec-websocket-extensions" => true,
        "sec-websocket-version" => true,
        "sec-websocket-accept" => true,
        _ => false,
    }
}

fn rebase_uri(target: &RunTarget, incoming_uri: &Uri, new_protocol: Option<&str>) -> Uri {
    let scheme = new_protocol.unwrap_or(target.upstream.scheme_str().unwrap());
    let authority = target.upstream.authority().unwrap().clone();

    let path_and_query = if target.remove_prefix && !target.is_default() {
        target.strip_prefix(incoming_uri.path_and_query().unwrap().as_str())
    } else {
        incoming_uri.path_and_query().unwrap().as_str()
    };

    Uri::builder()
        .scheme(scheme)
        .authority(authority)
        .path_and_query(path_and_query)
        .build()
        .unwrap()
}

async fn proxy(
    request: HttpRequest,
    stream: web::Payload,
    state: web::Data<ProxyState>,
) -> Result<HttpResponse, actix_web::Error> {
    // First, we search for the target to apply, if none is found we go to the default one unless
    // we do not have, then we just return a basic 404 Not Found error.
    let target = state
        .targets
        .iter()
        .find(|&potential_target| potential_target.path_matches_prefix(request.path()))
        .or(state.default_target.as_ref());
    if target.is_none() {
        return Ok(HttpResponse::NotFound().body("404 Not Found"));
    }

    match request.headers().get(&header::UPGRADE) {
        Some(header) if header.as_bytes() == b"websocket" => {
            let back_uri = rebase_uri(target.unwrap(), request.uri(), Some("ws"));

            debug!("proxy: websocket - received request forwarded to {back_uri}");
            // open a websocket connection to the backend
            let mut back_request = state.client.ws(back_uri);
            for header in request.headers() {
                if !is_hop_by_hop(header.0.as_str()) {
                    back_request = back_request.header(header.0, header.1);
                }
            }
            let (back_response, back_ws) = back_request.connect().await.unwrap();

            let mut res = ws::handshake(&request)?;
            for header in back_response.headers() {
                if !is_hop_by_hop(header.0.as_str()) {
                    res.append_header(header);
                }
            }
            let (back_tx, back_rx) = back_ws.split();
            Ok(res.streaming(ws::WebsocketContext::create(
                websocket_proxy::ClientProxyActor::new(back_rx, back_tx),
                stream,
            )))
        }
        _ => {
            let back_uri = rebase_uri(target.unwrap(), request.uri(), None);

            debug!("proxy: http - received request forwarded to {back_uri}");
            let mut back_request = state.client.request(request.method().clone(), back_uri);
            for header in request.headers() {
                if !is_hop_by_hop(header.0.as_str()) {
                    back_request = back_request.append_header(header);
                }
            }

            let back_response = back_request
                .send_stream(stream)
                .await
                .map_err(SendRequestError)?;
            let mut response = HttpResponse::build(back_response.status());

            for response_header in back_response.headers() {
                if !is_hop_by_hop(response_header.0.as_str()) {
                    response.append_header(response_header);
                }
            }

            Ok(response.streaming(back_response))
        }
    }
}

struct ProxyState {
    client: Client,
    targets: Vec<RunTarget>,
    default_target: Option<RunTarget>,
}

#[derive(Clone)]
pub struct RunTarget {
    pub prefix: Option<String>,
    pub upstream: Uri,
    pub remove_prefix: bool,
}

#[derive(Debug)]
pub enum UriParseError {
    SchemeOrAuthorityMissing,
    InvalidUri(actix_web::http::uri::InvalidUri),
}

fn parse_and_check_uri(s: &str) -> Result<Uri, UriParseError> {
    let parsed_uri = actix_web::http::Uri::try_from(s).map_err(|e| UriParseError::InvalidUri(e))?;

    if parsed_uri.scheme().is_none() || parsed_uri.authority().is_none() {
        return Err(UriParseError::SchemeOrAuthorityMissing);
    }

    Ok(parsed_uri)
}

impl RunTarget {
    fn is_default(&self) -> bool {
        self.prefix.is_none()
    }

    fn path_matches_prefix(&self, path: &str) -> bool {
        if let Some(prefix) = &self.prefix {
            path.starts_with(prefix)
        } else {
            false
        }
    }

    fn strip_prefix<'a>(&self, path: &'a str) -> &'a str {
        if let Some(prefix) = &self.prefix {
            path.strip_prefix(prefix).unwrap_or(path)
        } else {
            path
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("debug"));

    // Process configuration
    let config = proxy_config::load().unwrap_or_else(|e| {
        error!("Cannot load configuration: {}", e);
        std::process::exit(1);
    });
    let listen_addr = config.listen_addr.clone();
    let port = config.port;
    let default_target = config.default_target.clone();

    // Build targets
    let targets = config
        .targets
        .iter()
        .map(|target| RunTarget {
            prefix: Some(target.prefix.clone()),
            upstream: parse_and_check_uri(target.upstream.as_str()).unwrap(),
            remove_prefix: target.remove_prefix.unwrap_or(false),
        })
        .collect::<Vec<RunTarget>>();
    let default_target = {
        if let Some(default_target) = &default_target {
            Some(RunTarget {
                prefix: None,
                upstream: parse_and_check_uri(default_target.as_str()).unwrap(),
                remove_prefix: false,
            })
        } else {
            None
        }
    };

    // Start server
    HttpServer::new(move || {
        let mut app = App::new()
            .wrap(Logger::default())
            .app_data(web::Data::new(ProxyState {
                client: awc::Client::new(),
                targets: targets.clone(),
                default_target: default_target.clone(),
            }));

        if let Some(ref static_folder) = config.static_folder {
            info!(
                "Serving default route with static file from {}",
                static_folder
            );
            if config.default_target.is_some() {
                warn!("The value set in default_target will be ignored")
            }
            app = app.service(actix_files::Files::new("/", static_folder).index_file("index.html"))
        } else {
            info!("Using default upstream route");
        }

        app.default_service(web::route().to(proxy))
    })
    .bind((listen_addr, port))?
    .run()
    .await
}
