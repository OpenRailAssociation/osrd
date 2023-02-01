use std::sync::Arc;

use crate::api_error::{ApiError, ApiResult};

use crate::db_connection::DBConnection;
use crate::infra::RAILJSON_VERSION;
use crate::infra_cache::InfraCache;
use crate::schema::RailJson;
use chashmap::CHashMap;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel::{sql_query, RunQueryDsl};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Error as JsonError, Json, Value as JsonValue};
use rocket::State;
use thiserror::Error;

/// Return the endpoints routes of this module
pub fn routes() -> Vec<rocket::Route> {
    routes![get_railjson, post_railjson]
}

#[derive(QueryableByName)]
struct RailJsonData {
    #[diesel(sql_type = Text)]
    railjson: String,
}

#[derive(Debug, Error)]
enum ListErrorsRailjson {
    #[error("Wrong Railjson version provided")]
    WrongRailjsonVersionProvided,
}

impl ApiError for ListErrorsRailjson {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        match self {
            ListErrorsRailjson::WrongRailjsonVersionProvided => {
                "editoast:infra:railjson:WrongRailjsonVersionProvided"
            }
        }
    }
}
/// Serialize an infra
#[get("/<infra>/railjson?<exclude_extensions>")]
pub async fn get_railjson(
    infra: i64,
    exclude_extensions: bool,
    conn: DBConnection,
) -> ApiResult<Custom<String>> {
    let query = if exclude_extensions {
        include_str!("sql/get_infra_no_ext.sql")
    } else {
        include_str!("sql/get_infra_with_ext.sql")
    };
    let railjson: RailJsonData = conn
        .run(move |conn| sql_query(query).bind::<BigInt, _>(infra).get_result(conn))
        .await?;
    Ok(Custom(Status::Ok, railjson.railjson))
}

/// Import an infra
#[post("/railjson?<name>&<generate_data>", data = "<data>")]
pub async fn post_railjson(
    name: String,
    generate_data: bool,
    data: Result<Json<RailJson>, JsonError<'_>>,
    conn: DBConnection,
    infra_caches: &State<Arc<CHashMap<i64, InfraCache>>>,
) -> ApiResult<Custom<JsonValue>> {
    let infra_caches = infra_caches.inner().clone();
    let railjson = data?.0;
    if railjson.version != RAILJSON_VERSION {
        return Err(ListErrorsRailjson::WrongRailjsonVersionProvided.into());
    }

    conn.run(move |conn| {
        let infra = railjson.persist(name, conn)?;
        let infra = infra.bump_version(conn)?;
        if generate_data {
            let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra)?;
            infra.refresh(conn, true, &infra_cache)?;
        }

        Ok(Custom(Status::Ok, json!({ "infra": infra.id })))
    })
    .await
}
