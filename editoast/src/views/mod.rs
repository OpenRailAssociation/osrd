mod infra;
pub mod params;

use rocket::{routes, Route};
use std::collections::HashMap;

pub fn routes() -> HashMap<&'static str, Vec<Route>> {
    HashMap::from([("/", routes![health]), ("/infra", infra::routes())])
}

#[get("/health")]
pub fn health() {}
