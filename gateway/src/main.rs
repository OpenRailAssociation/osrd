use actix_web::http::{header, StatusCode};
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, ResponseError};

use actix_web_actors::ws;
use awc::error::{ConnectError, SendRequestError as AwcSendRequestError};
use awc::Client;
use futures_util::StreamExt;

use std::fmt;

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

struct ProxySettings {
    client: Client,
    target: String,
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

async fn proxy(
    request: HttpRequest,
    stream: web::Payload,
    settings: web::Data<ProxySettings>,
    path: web::Path<String>,
) -> Result<HttpResponse, actix_web::Error> {
    // let back_uri = rebase_uri(request.uri(), "/api", &http::Uri::from_static());
    let mut back_uri = if let Some(query) = request.uri().query() {
        format!("{0}/{path}?{query}", settings.target)
    } else {
        format!("{0}/{path}", settings.target)
    };

    match request.headers().get(&header::UPGRADE) {
        Some(header) if header.as_bytes() == b"websocket" => {
            back_uri.replace_range(0..4, "ws");
            log::info!("WS: connecting to {back_uri}");
            // open a websocket connection to the backend
            let mut back_request = settings.client.ws(back_uri);
            for header in request.headers() {
                if ! is_hop_by_hop(header.0.as_str()) {
                    back_request = back_request.header(header.0, header.1);
                }
            }
            let (back_response, back_ws) = back_request.connect().await.unwrap();
            log::info!("WS: connection complete");

            let mut res = ws::handshake(&request)?;
            for header in back_response.headers() {
                if ! is_hop_by_hop(header.0.as_str()) {
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
            log::info!("HTTP: connecting to {back_uri}");
            let mut back_request = settings.client.request(request.method().clone(), back_uri);
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    HttpServer::new(|| {
        App::new()
            .app_data(web::Data::new(ProxySettings {
                client: awc::Client::new(),
                target: "http://localhost:3000".to_owned(),
            }))
            .route("/{path:.*}", web::route().to(proxy))
        //.service(actix_files::Files::new("/", "static").index_file("index.html"))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
