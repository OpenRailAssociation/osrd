mod infra;
use rocket::serde::json::Value as JsonValue;
pub mod pagination;
pub mod params;

use diesel::{sql_query, RunQueryDsl};
use rocket::{routes, Route};
use std::collections::HashMap;
use std::env;

use crate::db_connection::DBConnection;

pub fn routes() -> HashMap<&'static str, Vec<Route>> {
    HashMap::from([("/", routes![health, version]), ("/infra", infra::routes())])
}

#[get("/health")]
pub async fn health(conn: DBConnection) -> &'static str {
    // Check DB connection
    conn.run(|conn| sql_query("SELECT 1").execute(conn).unwrap())
        .await;
    "ok"
}

#[get("/version")]
pub fn version() -> JsonValue {
    let mut res = HashMap::new();
    let describe = env::var("OSRD_GIT_DESCRIBE").ok();
    res.insert("git_describe", describe);
    serde_json::to_value(res).unwrap()
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::create_server;
    use rocket::http::Status;
    use rocket::local::blocking::Client;
    use std::collections::HashMap;

    /// Create a test editoast client
    /// This client create a single new connection to the database
    pub fn create_test_client() -> Client {
        let pg_config = PostgresConfig {
            pool_size: 1,
            ..Default::default()
        };
        let rocket = create_server(&Default::default(), &pg_config, Default::default());
        Client::tracked(rocket).expect("valid rocket instance")
    }

    #[test]
    fn health() {
        let client = create_test_client();
        let response = client.get("/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }

    #[test]
    fn version() {
        let client = create_test_client();
        let response = client.get("/version").dispatch();
        assert_eq!(response.status(), Status::Ok);
        let json_response: HashMap<String, Option<String>> = response.into_json().unwrap();
        assert!(json_response.contains_key("git_describe"))
    }
}
