pub mod cli;

use crate::cli::ApplyArgs;
use crate::cli::CliParser;
use crate::cli::Commands;
use crate::cli::OpenfgaArgs;
use common::tracing::SpanUploading;
use common::tracing::Stream;
use common::tracing::Telemetry;
use common::tracing::TracingConfig;
use common::tracing::create_tracing_subscriber;
use fga::Client;
use fga::client::ConnectionSettings;
use fga_migrations::MigrationError;
use fga_migrations::TargetMigration;
use fga_migrations::run_migrations;

use opentelemetry_otlp::WithExportConfig;
use tracing::info;
use tracing_subscriber::util::SubscriberInitExt;

use clap::Parser;
use url::Url;

fn setup_telemetry(telemetry_url: Url) {
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(telemetry_url.as_str())
        .build()
        .expect("failed to build a span exporter");

    let telemetry = Some(Telemetry {
        service_name: "fga-migrations".to_string(),
        endpoint: telemetry_url,
    });

    let tracing_config = TracingConfig {
        stream: Stream::Stderr,
        telemetry,
        directives: vec![],
        span_uploading: SpanUploading::Blocking,
    };
    create_tracing_subscriber(
        tracing_config,
        tracing_subscriber::filter::LevelFilter::INFO,
        exporter,
    )
    .init();
}

async fn setup_clients(openfga_args: OpenfgaArgs) -> Result<(Client, Client), MigrationError> {
    let connection_settings = &ConnectionSettings::new(
        openfga_args.openfga_url,
        fga::client::Limits {
            max_checks_per_batch_check: openfga_args.tuple_reads,
            max_tuples_per_write: openfga_args.tuple_writes,
        },
    );
    let client_authz = match Client::try_with_store(
        &openfga_args.authorization_store,
        connection_settings.clone(),
    )
    .await
    {
        Err(fga::client::InitializationError::NotFound(_)) => {
            info!("Authorization store not found, creating it.");
            Client::try_new_store(
                &openfga_args.authorization_store,
                connection_settings.clone(),
            )
            .await?
        }
        result => result?,
    };
    let client_migrations =
        match Client::try_with_store(&openfga_args.migrations_store, connection_settings.clone())
            .await
        {
            Err(fga::client::InitializationError::NotFound(_)) => {
                info!("Migrations store not found, creating it.");
                Client::try_new_store(&openfga_args.migrations_store, connection_settings.clone())
                    .await?
            }
            result => result?,
        };
    Ok((client_authz, client_migrations))
}

#[tokio::main]
async fn main() -> Result<(), MigrationError> {
    let parser = CliParser::parse();
    if let Some(endpoint) = parser.telemetry_endpoint {
        setup_telemetry(endpoint);
    }
    let (client_authz, client_migrations) = setup_clients(parser.openfga_args).await?;
    match &parser.command {
        Commands::Apply(ApplyArgs { target_migration }) => {
            let target_migration = match target_migration {
                Some(migration_name) => TargetMigration::Name(migration_name.clone()),
                None => TargetMigration::Latest,
            };
            run_migrations(client_authz, client_migrations, target_migration).await?;
            Ok(())
        }
    }
}
