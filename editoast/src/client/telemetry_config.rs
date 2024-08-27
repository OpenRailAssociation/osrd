use clap::Args;
use clap::ValueEnum;
use derivative::Derivative;
use url::Url;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct TelemetryConfig {
    #[derivative(Default(value = "TelemetryKind::None"))]
    #[clap(long, env, default_value_t)]
    pub telemetry_kind: TelemetryKind,
    #[derivative(Default(value = r#""osrd-editoast".into()"#))]
    #[clap(long, env, default_value = "osrd-editoast")]
    pub service_name: String,
    #[derivative(Default(value = r#"Url::parse("http://localhost:4317").unwrap()"#))]
    #[arg(long, env, default_value = "http://localhost:4317")]
    pub telemetry_endpoint: Url,
}

#[derive(Default, ValueEnum, Debug, Derivative, Clone, strum::Display)]
#[strum(serialize_all = "lowercase")]
pub enum TelemetryKind {
    #[default]
    None,
    #[cfg(feature = "datadog")]
    Datadog,
    Opentelemetry,
}
