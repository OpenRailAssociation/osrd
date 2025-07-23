use clap::Args;
use clap::Parser;
use clap::Subcommand;
use fga::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
use fga::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
use url::Url;

#[derive(Debug, Parser)]
pub struct CliParser {
    #[command(flatten)]
    pub openfga_args: OpenfgaArgs,
    /// Url of the opentelemetry backend
    #[arg(long)]
    pub telemetry_endpoint: Option<Url>,
    #[clap(subcommand)]
    pub command: Commands,
}

#[derive(Args, Debug)]
pub struct OpenfgaArgs {
    /// OpenFGA server URL
    #[arg(long, env = "FGA_API_URL", default_value_t = Url::parse("http://localhost:8091").unwrap())]
    pub openfga_url: Url,
    /// OpenFGA server max tuple reads per batch check
    #[arg(long, env = "OPENFGA_MAX_CHECKS_PER_BATCH_CHECK", default_value_t = DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK)]
    pub tuple_reads: u32,
    /// OpenFGA server max tuples per write request
    #[arg(long, env = "OPENFGA_MAX_TUPLES_PER_WRITE", default_value_t = DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE)]
    pub tuple_writes: u64,
    /// OpenFGA migrations store
    #[arg(
        long,
        env = "EDITOAST_FGA_MIGRATIONS_STORE_NAME",
        default_value = "fga-migrations"
    )]
    pub migrations_store: String,
    /// The store on which to apply the migrations
    #[arg(
        long,
        env = "EDITOAST_AUTHORIZATION_STORE_NAME",
        default_value = "osrd-editoast"
    )]
    pub authorization_store: String,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Migrate the OpenFGA model to a given version
    Apply(ApplyArgs),
}

#[derive(Args, Debug)]
pub struct ApplyArgs {
    /// The migration name. If unset, the latest model migration is applied
    pub target_migration: Option<String>,
}
