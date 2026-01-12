use clap::Parser;
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(about, long_about = "Extracts a railjson from OpenStreetMap data")]
pub struct OsmToRailjsonArgs {
    /// Input file in the OSM PBF format
    pub osm_pbf_in: PathBuf,
    /// Output file in Railjson format
    pub railjson_out: PathBuf,
    /// Option to generate realistic signals (overrides existing signals)
    #[arg(long, default_value_t = false)]
    pub generate_signals: bool,
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let args = OsmToRailjsonArgs::parse();
    osm_to_railjson::osm_to_railjson(args.osm_pbf_in, args.railjson_out, args.generate_signals)
        .expect("Could not convert osm to railjson");
}
