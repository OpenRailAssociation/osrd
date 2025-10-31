use opentelemetry::trace::TracerProvider;
use opentelemetry_sdk::Resource;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace::SpanExporter;
use tracing_subscriber::Layer;
use tracing_subscriber::layer::SubscriberExt;
use url::Url;

#[derive(Debug, PartialEq)]
pub enum Stream {
    Stderr,
    Stdout,
}

#[derive(Debug)]
pub struct Telemetry {
    pub service_name: String,
    pub endpoint: Url,
}

pub struct TracingConfig {
    pub stream: Stream,
    pub telemetry: Option<Telemetry>,
    pub directives: Vec<tracing_subscriber::filter::Directive>,
    pub span_uploading: SpanUploading,
}

pub enum SpanUploading {
    Blocking,
    BackgroundBatched,
}

pub fn create_tracing_subscriber<T: SpanExporter + 'static>(
    tracing_config: TracingConfig,
    log_level: tracing_subscriber::filter::LevelFilter,
    exporter: T,
) -> impl tracing::Subscriber {
    let env_filter_layer = tracing_subscriber::EnvFilter::builder()
        // Set the default log level to 'info'
        .with_default_directive(log_level.into())
        .from_env_lossy();
    let env_filter_layer = tracing_config
        .directives
        .clone()
        .into_iter()
        .fold(env_filter_layer, |env_filter_layer, directive| {
            env_filter_layer.add_directive(directive)
        });
    let fmt_layer = tracing_subscriber::fmt::layer()
        .pretty()
        .with_file(true)
        .with_line_number(false);
    let fmt_layer = if tracing_config.stream == Stream::Stderr {
        fmt_layer.with_writer(std::io::stderr).boxed()
    } else {
        fmt_layer.boxed()
    };
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/layer/index.html#runtime-configuration-with-layers
    let telemetry_layer = match tracing_config.telemetry {
        None => None,
        Some(telemetry) => {
            let resource = Resource::builder()
                .with_service_name(telemetry.service_name.clone())
                .build();

            let otlp_tracer =
                opentelemetry_sdk::trace::SdkTracerProvider::builder().with_resource(resource);
            let otlp_tracer = match tracing_config.span_uploading {
                SpanUploading::Blocking => otlp_tracer.with_simple_exporter(exporter),
                SpanUploading::BackgroundBatched => otlp_tracer.with_batch_exporter(exporter),
            }
            .build()
            .tracer("osrd-editoast");

            let layer = tracing_opentelemetry::OpenTelemetryLayer::new(otlp_tracer);
            opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());
            Some(layer)
        }
    };

    tracing_subscriber::registry()
        .with(telemetry_layer)
        .with(env_filter_layer)
        .with(fmt_layer)
}
