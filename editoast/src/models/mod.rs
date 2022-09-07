pub mod errors;
pub mod infra;
pub mod infra_errors;

pub use infra::{CreateInfra, Infra, InfraError};

use rocket_contrib::databases::diesel;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
