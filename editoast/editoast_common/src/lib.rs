pub mod geometry;
mod hash_rounded_float;
pub mod rangemap_utils;
pub mod schemas;
pub mod tracing;
pub mod units;

pub use hash_rounded_float::hash_float;
pub use hash_rounded_float::hash_float_slice;

schemas! {
    geometry::schemas(),
}

pub fn setup_tracing_for_test() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .without_time()
        .pretty()
        .try_init()
        .ok();
}
