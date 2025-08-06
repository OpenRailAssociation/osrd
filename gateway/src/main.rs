use std::process::exit;
use std::rc::Rc;

use actix_proxy::IpNet;
use actix_proxy::Proxy;
use actix_session::SessionMiddleware;
use actix_session::storage::CookieSessionStore;
use actix_web::cookie::SameSite;
use actix_web::{
    App, HttpServer,
    middleware::{Compress, Logger},
};
use actix_web::{HttpResponse, web};
use actix_web_opentelemetry::RequestTracing;
use config_parser::{
    Files, parse_auth_config, parse_files_config, parse_secret_key, parse_targets,
};
use either::Either;
use log::error;

use actix_auth::AuthMiddleware;

mod config;
mod config_parser;
mod request_modifier;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    // Process configuration
    let config = config::load().unwrap_or_else(|e| {
        error!("Cannot load configuration: {e}");
        exit(1);
    });

    let secret_key = parse_secret_key(&config.secret_key);

    let listen_addr = config.listen_addr.clone();
    let port = config.port;
    let trusted_proxies: Vec<IpNet> = config
        .trusted_proxies
        .iter()
        .map(|s| s.parse().expect("Invalid trusted proxy IP CIDR"))
        .collect::<Vec<_>>();

    let auth_context = parse_auth_config(config.auth.clone()).await;
    let (proxy_targets, default_proxy_target) =
        parse_targets(config.clone(), trusted_proxies.clone());
    let files_config = config.static_files.as_ref().map(parse_files_config);

    let default_service: Option<Either<Proxy, Files>> = match (default_proxy_target, files_config) {
        (Some(proxy), None) => Some(Either::Left(proxy)),
        (None, Some(files)) => Some(Either::Right(files)),
        (Some(_), Some(_)) => {
            error!(
                "both a default proxy target and a files config are provided, which are both default services"
            );
            exit(1);
        }
        (None, None) => None,
    };

    // Enable telemetry
    config.telemetry.enable();

    // CORS configuration
    let allowed_origins = config.allowed_origins.clone();

    // Start server
    HttpServer::new(move || {
        let session_middleware =
            SessionMiddleware::builder(CookieSessionStore::default(), secret_key.clone())
                .cookie_secure(config.auth.secure_cookies) // Safari doesn't forward secure cookies on localhost
                // the policy has to be lax for the cookie to be readable in the OIDC callback
                .cookie_same_site(SameSite::Lax)
                .cookie_name("gateway".to_string())
                .build();

        let cors = if let Some(allowed_origins) = &allowed_origins {
            let mut cors = actix_cors::Cors::default();
            for origin in allowed_origins {
                cors = cors.allowed_origin(origin);
            }
            cors.allow_any_method().allow_any_header().max_age(3600)
        } else {
            actix_cors::Cors::default()
        };

        let mut app = App::new()
            .wrap(cors)
            .wrap(RequestTracing::new())
            .wrap(Compress::default()) // enable compress
            .route("/health", web::get().to(|| async { "OK" }))
            .wrap(AuthMiddleware::new(Rc::new(auth_context.clone())))
            .wrap(session_middleware)
            .wrap(Logger::default())
            .service(
                web::scope("/auth")
                    .configure(actix_auth::config)
                    .default_service(web::to(HttpResponse::NotFound)),
            );

        for target in proxy_targets.clone() {
            app = app.service(target);
        }

        // configure the default service
        match &default_service {
            Some(Either::Left(proxy)) => app = app.default_service(proxy.clone()),
            Some(Either::Right(files_config)) => {
                app = app.configure(files_config.get_config());
            }
            None => (),
        }

        app
    })
    .bind((listen_addr, port))?
    .run()
    .await
}
