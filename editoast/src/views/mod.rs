mod infra;
pub mod pagination;
pub mod params;

use diesel::{sql_query, RunQueryDsl};
use rocket::{routes, Route};
use std::collections::HashMap;

use crate::models::DBConnection;

pub fn routes() -> HashMap<&'static str, Vec<Route>> {
    HashMap::from([("/", routes![health]), ("/infra", infra::routes())])
}

#[get("/health")]
pub fn health(conn: DBConnection) -> &'static str {
    // Check DB connection
    sql_query("SELECT 1").execute(&conn.0).unwrap();
    "ok"
}

#[cfg(test)]
mod tests {
    use crate::create_server;
    use rocket::http::Status;
    use rocket::local::Client;

    #[test]
    fn health() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );
        let client = Client::new(rocket).expect("valid rocket instance");
        let response = client.get("/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
}
