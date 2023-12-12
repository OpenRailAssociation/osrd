use std::{collections::HashMap, time::Duration};

use figment::{
    providers::{Env, Format, Serialized, Toml},
    Figment,
};
use log::info;
use opentelemetry::global;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{runtime::TokioCurrentThread, trace::TracerProvider};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
pub struct Telemetry {
    tracing: TracingTelemetry,
}

impl Telemetry {
    pub fn enable(self) {
        self.tracing.enable_providers();
    }
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub struct TracingTelemetry {
    enable: bool,
    endpoint: String,
}

impl TracingTelemetry {
    pub fn enable_providers(self) {
        if !self.enable {
            info!("Tracing disabled");
            return;
        }

        let exporter = opentelemetry_otlp::new_exporter()
            .tonic()
            .with_endpoint(self.endpoint)
            .build_span_exporter()
            .expect("Failed to initialize otlp exporter");

        info!("Tracing enabled with otlp");

        let provider = TracerProvider::builder()
            .with_config(opentelemetry_sdk::trace::Config::default().with_resource(
                opentelemetry_sdk::Resource::new(vec![opentelemetry::KeyValue::new(
                    "service.name",
                    "gateway",
                )]),
            ))
            .with_batch_exporter(exporter, TokioCurrentThread)
            .build();

        global::set_tracer_provider(provider);
    }
}

/// A proxy route
#[derive(Deserialize, Serialize, Clone)]
pub struct ProxyTarget {
    /// The request path must start with this prefix for the target to apply.
    /// If omitted, the target becomes the default. There can only be a single default target.
    pub prefix: Option<String>,
    /// The base URL requests are proxied to (must include the scheme)
    pub upstream: String,
    /// Whether requests need authentication to be relayed upstream.
    /// If true, unauthenticated requests get a 401 Unauthorized response.
    pub require_auth: bool,
    /// A list of headers that need to be forwarded. If omitted, all headers are forwarded.
    /// Omitting this field is not recommended, as it can introduce normalization induced priviledge escalation.
    pub forwarded_headers: Option<Vec<String>>,
    /// A connection, send and read timeout
    #[serde(default, with = "humantime_serde")]
    pub timeout: Option<Duration>,
    /// The tracing name for this target
    pub tracing_name: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct FilesConfig {
    /// The root folder filesystem path
    pub root_folder: String,
    pub redirect_404_to_index: bool,
}

/// Authentication provider
#[derive(Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AuthProvider {
    /// Mocked authentication provider
    /// This provider will always return the same username
    Mocked {
        provider_id: String,
        username: String,
        require_login: bool,
        user_id: Option<String>,
    },

    /// Basic authentication provider
    /// This provider will check request's token against the map
    /// and will use the token name as the username
    Bearer {
        provider_id: String,
        tokens: HashMap<String, String>,
    },

    /// OpenID Connect authentication provider
    /// This provider will redirect the user to the issuer_url to authenticate
    /// and then redirect the user to the callback_url
    /// Check the documentation of oidc for more information
    Oidc {
        provider_id: String,
        issuer_url: Box<actix_auth::oidc::IssuerUrl>,
        post_login_url: Box<actix_auth::oidc::Url>,
        callback_url: Box<actix_auth::oidc::RedirectUrl>,
        client_id: String,
        client_secret: String,
        profile_scope_override: Option<String>,
    },
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ProxyConfig {
    /// Address on which the gateway will listen
    pub listen_addr: String,
    /// Port on which the gateway will listen
    pub port: u16,
    /// A base64-encoded secret key, used to encrypt and sign cookies
    pub secret_key: Option<String>,
    /// Folder to serve as static files
    pub static_files: Option<FilesConfig>,
    /// List of targets to proxy to
    pub targets: Vec<ProxyTarget>,
    /// List of trusted proxies (for X-Forwarded-For)
    pub trusted_proxies: Vec<String>,
    /// Authentication configuration
    pub auth: AuthConfig,
    /// Telemetry configuration
    pub telemetry: Option<Telemetry>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AuthConfig {
    pub default_provider: Option<String>,
    pub secure_cookies: bool,
    pub providers: Vec<AuthProvider>,
}

impl Default for ProxyConfig {
    fn default() -> ProxyConfig {
        ProxyConfig {
            listen_addr: "127.0.0.1".to_string(),
            port: 4000,
            secret_key: None,
            static_files: None,
            trusted_proxies: vec![],
            targets: vec![],
            auth: AuthConfig {
                default_provider: None,
                secure_cookies: true,
                providers: vec![],
            },
            telemetry: None,
        }
    }
}

pub fn load() -> Result<ProxyConfig, figment::Error> {
    Figment::from(Serialized::defaults(ProxyConfig::default()))
        .merge(Toml::file("gateway.toml"))
        .merge(Env::prefixed("GATEWAY_"))
        .extract()
}
