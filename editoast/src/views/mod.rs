mod infra;
mod layers;
use rocket::serde::json::Value as JsonValue;
use rocket_db_pools::deadpool_redis;
pub mod pagination;
pub mod params;

use crate::db_connection::{DBConnection, RedisPool};
use deadpool_redis::redis::cmd;
use diesel::{sql_query, RunQueryDsl};
use rocket::{routes, Route};
use std::collections::HashMap;
use std::env;

pub fn routes() -> HashMap<&'static str, Vec<Route>> {
    HashMap::from([
        ("/", routes![health, version, opt::all_options]),
        ("/infra", infra::routes()),
        ("/layers", layers::routes()),
    ])
}

#[allow(clippy::let_unit_value)]
mod opt {
    /// Catches all OPTION requests in order to get the CORS related Fairing triggered.
    #[options("/<_..>")]
    pub fn all_options() {
        /* Intentionally left empty */
    }
}

#[get("/health")]
async fn health(conn: DBConnection, pool: &RedisPool) -> &'static str {
    conn.run(|conn| sql_query("SELECT 1").execute(conn).unwrap())
        .await;
    let _ = cmd("PING")
        .query_async::<_, ()>(&mut pool.get().await.unwrap())
        .await;
    "ok"
}

#[get("/version")]
fn version() -> JsonValue {
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
        let rocket = create_server(&Default::default(), &pg_config, &Default::default());
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
