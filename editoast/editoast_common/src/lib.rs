pub mod geometry;
mod hash_rounded_float;
pub mod rangemap_utils;
pub mod schemas;
pub mod tracing;
pub mod units;

pub use hash_rounded_float::hash_float;
pub use hash_rounded_float::hash_float_slice;
use http::StatusCode;
use serde::Deserialize;
use serde::Serialize;

schemas! {
    geometry::schemas(),
}

#[derive(Serialize, Deserialize)]
#[serde(remote = "StatusCode")]
pub struct StatusCodeRemoteDef(#[serde(getter = "StatusCode::as_u16")] u16);

impl From<StatusCodeRemoteDef> for StatusCode {
    fn from(def: StatusCodeRemoteDef) -> Self {
        StatusCode::from_u16(def.0).unwrap()
    }
}

pub fn default_status_code() -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}
