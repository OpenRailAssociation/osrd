use clap::Args;
use clap::ValueEnum;
use educe::Educe;
use url::Url;

#[derive(Args, Debug, Educe, Clone)]
#[educe(Default)]
pub struct TelemetryConfig {
    #[educe(Default = TelemetryKind::None)]
    #[clap(long, env, default_value_t)]
    pub telemetry_kind: TelemetryKind,
    #[educe(Default = "osrd-editoast".into())]
    #[clap(long, env, default_value = "osrd-editoast")]
    pub service_name: String,
    #[educe(Default = Url::parse("http://localhost:4317").unwrap())]
    #[arg(long, env, default_value = "http://localhost:4317")]
    pub telemetry_endpoint: Url,
}

impl From<TelemetryConfig> for common::tracing::Telemetry {
    fn from(telemetry_config: TelemetryConfig) -> Self {
        Self {
            service_name: telemetry_config.service_name,
            endpoint: telemetry_config.telemetry_endpoint,
        }
    }
}

#[derive(Default, ValueEnum, Debug, Clone, strum::Display)]
#[strum(serialize_all = "lowercase")]
pub enum TelemetryKind {
    #[default]
    None,
    Opentelemetry,
}
