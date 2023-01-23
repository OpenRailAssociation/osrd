use crate::api_error::{ApiError, ApiResult};
use crate::db_connection::DBConnection;
use crate::schema::InfraErrorType;
use crate::views::pagination::{paginate, PaginationError};
use diesel::sql_types::{BigInt, Json, Nullable, Text};
use diesel::{PgConnection, RunQueryDsl};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Value as JsonValue};
use serde::Serialize;
use serde_json::Value;
use strum::VariantNames;
use thiserror::Error;

pub fn routes() -> Vec<rocket::Route> {
    routes![list_errors]
}

/// Return the list of errors of an infra
#[get("/<infra>/errors?<page>&<page_size>&<error_type>&<object_id>&<level>")]
async fn list_errors(
    infra: i64,
    page: Option<i64>,
    page_size: Option<i64>,
    level: Option<Level>,
    error_type: Option<String>,
    object_id: Option<String>,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    if let Some(error_type) = &error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }
    let page = page.unwrap_or_default().max(1);
    let per_page = page_size.unwrap_or(25).max(10);
    let level = level.unwrap_or_default();
    let (infra_errors, count) = conn
        .run(move |conn| {
            get_paginated_infra_errors(conn, infra, page, per_page, level, error_type, object_id)
        })
        .await?;
    let previous = if page == 1 { None } else { Some(page - 1) };
    let max_page = (count as f64 / per_page as f64).ceil() as i64;
    let next = if page >= max_page {
        None
    } else {
        Some(page + 1)
    };
    Ok(Custom(
        Status::Ok,
        json!({ "count": count, "previous": previous, "next": next, "results": infra_errors }),
    ))
}

/// Check if the query parameter error_type exist
fn check_error_type_query(param: &String) -> bool {
    InfraErrorType::VARIANTS
        .iter()
        .any(|x| &x.to_string() == param)
}

#[derive(Debug, Error)]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

impl ApiError for ListErrorsErrors {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        match self {
            ListErrorsErrors::WrongErrorTypeProvided => "editoast:infra:WrongErrorTypeProvided",
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
struct InfraErrorQueryable {
    #[diesel(sql_type = BigInt)]
    pub count: i64,
    #[diesel(sql_type = Json)]
    pub information: Value,
    #[diesel(sql_type = Nullable<Json>)]
    pub geographic: Option<Value>,
    #[diesel(sql_type = Nullable<Json>)]
    pub schematic: Option<Value>,
}

#[derive(Default, Debug, PartialEq, Eq, FromFormField)]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields)]
struct InfraErrorModel {
    pub information: Value,
    pub geographic: Option<Value>,
    pub schematic: Option<Value>,
}

impl From<InfraErrorQueryable> for InfraErrorModel {
    fn from(error: InfraErrorQueryable) -> Self {
        Self {
            information: error.information,
            geographic: error.geographic,
            schematic: error.schematic,
        }
    }
}

fn get_paginated_infra_errors(
    conn: &mut PgConnection,
    infra: i64,
    page: i64,
    per_page: i64,
    level: Level,
    error_type: Option<String>,
    object_id: Option<String>,
) -> Result<(Vec<InfraErrorModel>, i64), Box<dyn ApiError>> {
    let mut query =
        String::from("SELECT information::text, ST_AsGeoJSON(ST_Transform(geographic, 4326))::json as geographic,
        ST_AsGeoJSON(ST_Transform(schematic, 4326))::json as schematic FROM osrd_infra_errorlayer WHERE infra_id = $1");
    if level == Level::Warnings {
        query += " AND information->>'is_warning' = 'true'"
    } else if level == Level::Errors {
        query += " AND information->>'is_warning' = 'false'"
    }
    if error_type.is_some() {
        query += " AND information->>'error_type' = $2"
    }
    if object_id.is_some() {
        query += " AND information->>'obj_id' = $3"
    }

    let infra_errors = paginate(query, page, per_page)
        .bind::<BigInt, _>(infra)
        .bind::<Text, _>(&error_type.unwrap_or_default())
        .bind::<Text, _>(&object_id.unwrap_or_default())
        .load::<InfraErrorQueryable>(conn)?;
    let count = infra_errors.first().map(|e| e.count).unwrap_or_default();
    let infra_errors: Vec<InfraErrorModel> = infra_errors.into_iter().map(|e| e.into()).collect();
    if infra_errors.is_empty() && page > 1 {
        return Err(Box::new(PaginationError));
    }
    Ok((infra_errors, count))
}

#[cfg(test)]
mod tests {
    use rocket::http::{ContentType, Status};

    use crate::infra::Infra;
    use crate::views::infra::errors::check_error_type_query;
    use crate::views::tests::create_test_client;

    #[test]
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

    #[test]
    fn list_errors_get() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_list_errors"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);
        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        let error_type = "overlapping_track_links";
        let level = "warnings";

        let list_errors_query = client
            .get(format!(
                "/infra/{}/errors?&error_type={}&level={}",
                infra.id, error_type, level
            ))
            .dispatch();
        assert_eq!(list_errors_query.status(), Status::Ok);
    }
}
