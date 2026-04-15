pub mod geometry;
mod hash_rounded_float;
pub mod rangemap_utils;
pub mod tracing;
pub mod units;

use std::collections::HashSet;
use std::hash::Hash;
use std::hash::Hasher;

pub use hash_rounded_float::hash_float;
pub use hash_rounded_float::hash_float_slice;

use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

pub fn setup_tracing_for_test() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .without_time()
        .pretty()
        .try_init()
        .ok();
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct Version {
    #[schema(required)] // Options are by default not required, but this one is
    pub git_describe: Option<String>,
}

/// Allows implementing Eq for floats considering all NaN values to be equal
///
/// Tip: provide this to Educe.
pub fn float_eq(a: &f64, b: &f64) -> bool {
    (a.is_nan() && b.is_nan()) || (a == b)
}

pub fn hashing_hash_set_string<H>(set: &HashSet<String>, state: &mut H)
where
    H: Hasher,
{
    let mut vec = set.iter().collect_vec();
    vec.sort();
    Hash::hash(&vec, state)
}
