use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    process::exit,
};

use actix_auth::{
    AuthContext, AuthProviderHandler, BearerProvider, MockProvider, OidcConfig, OidcProvider,
};
use actix_proxy::{HeaderName, IpNet, Proxy, Uri};
use actix_web::{
    cookie::Key,
    dev::{ServiceRequest, ServiceResponse},
    web,
};
use base64ct::Encoding;
use log::error;

use crate::{
    config::{self, AuthConfig, FilesConfig},
    request_modifier::ProxyAuthAdapter,
};

#[derive(Debug)]
pub enum UriParseError {
    SchemeOrAuthorityMissing,
    InvalidUri(#[allow(dead_code)] actix_web::http::uri::InvalidUri),
}

fn parse_and_check_uri(s: &str) -> Result<Uri, UriParseError> {
    let parsed_uri = actix_web::http::Uri::try_from(s).map_err(UriParseError::InvalidUri)?;

    if parsed_uri.scheme().is_none() || parsed_uri.authority().is_none() {
        return Err(UriParseError::SchemeOrAuthorityMissing);
    }

    Ok(parsed_uri)
}

pub fn parse_targets(
    config: super::config::ProxyConfig,
    trusted_proxies: Vec<IpNet>,
) -> (Vec<Proxy>, Option<Proxy>) {
    let mut default_target: Option<Proxy> = None;

    let mut targets = vec![];
    for target in config.targets.iter() {
        let forwarded_headers = target.forwarded_headers.as_ref().map(|headers| {
            headers
                .iter()
                .map(|header_name| match header_name.parse() {
                    Ok(header_name) => header_name,
                    Err(_) => {
                        error!("invalid header name: {}", header_name);
                        exit(1);
                    }
                })
                .collect::<Vec<HeaderName>>()
        });

        let blocked_headers = target
            .blocked_headers
            .as_ref()
            .map(|headers| {
                headers
                    .iter()
                    .map(|header_name| match header_name.parse() {
                        Ok(header_name) => header_name,
                        Err(_) => {
                            error!("invalid header name: {}", header_name);
                            exit(1);
                        }
                    })
                    .collect::<HashSet<HeaderName>>()
            })
            .unwrap_or_default();

        let parsed_target = Proxy::new(
            target.prefix.clone(),
            parse_and_check_uri(target.upstream.as_str()).unwrap(),
            trusted_proxies.clone(),
            forwarded_headers,
            blocked_headers,
            if target.require_auth {
                Some(Box::new(ProxyAuthAdapter))
            } else {
                None
            },
            target.timeout,
            target.tracing_name.clone(),
        );

        match &target.prefix {
            Some(_) => targets.push(parsed_target),
            None => {
                if default_target.is_some() {
                    error!("multiple default proxy targets defined");
                    exit(1);
                }
                default_target = Some(parsed_target)
            }
        }
    }

    (targets, default_target)
}

pub async fn parse_auth_config(config: AuthConfig) -> AuthContext {
    let mut auth_context = AuthContext::new("auth".to_owned());

    for auth_provider in config.providers {
        match auth_provider {
            config::AuthProvider::Mocked {
                provider_id,
                username,
                require_login,
                user_id,
            } => {
                let provider = MockProvider::new(require_login, username, user_id);
                auth_context
                    .add_identity_provider(format!("{provider_id}.identity"), provider.clone());
                auth_context.add_session_provider(provider_id, provider);
            }
            config::AuthProvider::Bearer {
                provider_id,
                tokens,
            } => {
                let provider = BearerProvider::new(tokens);
                auth_context.add_identity_provider(provider_id, provider);
            }
            config::AuthProvider::Oidc {
                provider_id,
                issuer_url,
                post_login_url,
                callback_url,
                client_id,
                client_secret,
                profile_scope_override,
                username_whitelist,
                amr,
                acr,
            } => {
                let cfg = &OidcConfig::new(
                    issuer_url,
                    post_login_url,
                    callback_url,
                    client_id,
                    client_secret,
                    acr,
                    amr,
                    profile_scope_override,
                    username_whitelist,
                );
                let provider = OidcProvider::from_config(cfg);
                auth_context.add_session_provider(provider_id, provider.await.unwrap());
            }
        };
    }

    if let Some(default_provider_id) = &config.default_provider {
        match auth_context.get_provider_handler(default_provider_id) {
            Some(AuthProviderHandler::Session(session)) => {
                auth_context.set_default_provider(session);
            }
            Some(AuthProviderHandler::Identity(_)) => {
                eprintln!(
                    "the default session provider cannot handle sessions: {}",
                    default_provider_id
                );
                exit(1);
            }
            None => {
                eprintln!("unknown default provider: {}", default_provider_id);
                exit(1);
            }
        }
    } else if let &[provider_handler] = auth_context
        .iter_session_providers()
        .collect::<Vec<_>>()
        .as_slice()
    {
        auth_context.set_default_provider(provider_handler);
    }

    auth_context
}

#[derive(Clone)]
pub struct Files {
    static_folder: String,
    error_404_path: &'static Option<PathBuf>,
}

impl Files {
    pub fn get_config(&self) -> impl FnOnce(&mut web::ServiceConfig) {
        let mut files = actix_files::Files::new("/", self.static_folder.clone())
            .prefer_utf8(true)
            .index_file("index.html");

        if let Some(error_404_path) = &self.error_404_path {
            files = files.default_handler(move |req: ServiceRequest| {
                let (http_req, _payload) = req.into_parts();

                async move {
                    let named_file = actix_files::NamedFile::open(error_404_path);
                    let response = match named_file {
                        Ok(named_file) => named_file.into_response(&http_req),
                        Err(err) => {
                            error!("failed to open 404 file: {}", err);
                            actix_web::HttpResponse::InternalServerError().finish()
                        }
                    };

                    Ok(ServiceResponse::new(http_req, response))
                }
            });
        }

        |app| {
            app.default_service(files);
        }
    }
}

pub fn parse_files_config(config: &FilesConfig) -> Files {
    let e404_path = Box::new(if config.redirect_404_to_index {
        Some(Path::new(config.root_folder.as_str()).join("index.html"))
    } else {
        None
    });
    let static_e404_path: &'static Option<PathBuf> = Box::leak(e404_path);

    Files {
        static_folder: config.root_folder.clone(),
        error_404_path: static_e404_path,
    }
}

pub fn parse_secret_key(key: &Option<String>) -> Key {
    let Some(key) = key else {
        error!("Missing secret key");
        exit(1);
    };

    let Ok(key) = base64ct::Base64::decode_vec(key) else {
        error!("Invalid base64 secret key encoding");
        exit(1);
    };

    match Key::try_from(key.as_slice()) {
        Ok(key) => key,
        Err(err) => {
            error!("Invalid secret key: {err}");
            exit(1);
        }
    }
}
