mod infra;
pub mod pagination;
pub mod params;

use diesel::{sql_query, RunQueryDsl};
use rocket::{routes, Route};
use std::collections::HashMap;

use crate::db_connection::DBConnection;

pub fn routes() -> HashMap<&'static str, Vec<Route>> {
    HashMap::from([("/", routes![health]), ("/infra", infra::routes())])
}

#[get("/health")]
pub async fn health(conn: DBConnection) -> &'static str {
    // Check DB connection
    conn.run(|conn| sql_query("SELECT 1").execute(conn).unwrap())
        .await;
    "ok"
}

#[cfg(test)]
mod tests {
    use crate::create_server;
    use rocket::http::Status;
    use rocket::local::blocking::Client;

    #[test]
    fn health() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );
        let client = Client::tracked(rocket).expect("valid rocket instance");
        let response = client.get("/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
}
