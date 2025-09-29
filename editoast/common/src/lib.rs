pub mod geometry;
mod hash_rounded_float;
pub mod rangemap_utils;
pub mod tracing;
pub mod units;

pub use hash_rounded_float::hash_float;
pub use hash_rounded_float::hash_float_slice;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

pub type OpenApiSchemaSliceItem = fn() -> (
    std::borrow::Cow<'static, str>,
    utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>,
);

#[linkme::distributed_slice]
pub static OPENAPI_SCHEMAS: [OpenApiSchemaSliceItem];

pub fn setup_tracing_for_test() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .without_time()
        .pretty()
        .try_init()
        .ok();
}

#[linkme::distributed_slice(OPENAPI_SCHEMAS)]
static _SCHEMA: OpenApiSchemaSliceItem = || {
    (
        <Version as utoipa::ToSchema>::name(),
        <Version as utoipa::PartialSchema>::schema(),
    )
};

#[derive(ToSchema, Serialize, Deserialize)]
pub struct Version {
    #[schema(required)] // Options are by default not required, but this one is
    pub git_describe: Option<String>,
}
