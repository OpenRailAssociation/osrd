use crate::api_error::ApiError;
use crate::api_error::ApiResult;
use crate::db_connection::DBConnection;
use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::schema::electrical_profiles::ElectricalProfileSet as ElectricalProfileSetSchema;
use crate::tables::osrd_infra_electricalprofileset;
use crate::tables::osrd_infra_electricalprofileset::dsl;
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{routes, Route};
use serde::Serialize;
use serde_json::Value;
use serde_json::{json, Map};
use thiserror::Error;

pub fn routes() -> Vec<Route> {
    routes![list, get, get_level_order]
}

/// =================================
/// Endpoints
/// =================================

/// Return a list of electrical profile sets
#[get("/")]
async fn list(conn: DBConnection) -> ApiResult<Json<Vec<ElectricalProfileSetMetaData>>> {
    conn.run(move |conn| match ElectricalProfileSet::list(conn) {
        Ok(light_ep_sets) => Ok(Json(light_ep_sets)),
        Err(e) => Err(e.into()),
    })
    .await
}

/// Return a specific set of electrical profiles
#[get("/<electrical_profile_set>")]
async fn get(
    conn: DBConnection,
    electrical_profile_set: i64,
) -> ApiResult<Json<ElectricalProfileSetSchema>> {
    conn.run(move |conn| {
        Ok(Json(ElectricalProfileSet::retrieve_data(
            conn,
            electrical_profile_set,
        )?))
    })
    .await
}

/// Return the electrical profile value order for this set
#[get("/<electrical_profile_set>/level_order")]
async fn get_level_order(
    conn: DBConnection,
    electrical_profile_set: i64,
) -> ApiResult<Json<Value>> {
    conn.run(move |conn| {
        Ok(Json(
            ElectricalProfileSet::retrieve_data(conn, electrical_profile_set)?.level_order,
        ))
    })
    .await
}

/// =================================
/// Queryables
/// =================================

#[derive(Debug, PartialEq, Queryable, Serialize)]
pub struct ElectricalProfileSetMetaData {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, PartialEq, Queryable, Insertable, Identifiable)]
#[diesel(table_name = osrd_infra_electricalprofileset)]
pub struct ElectricalProfileSet {
    pub id: i64,
    pub name: String,
    pub data: Value,
}

impl ElectricalProfileSet {
    fn retrieve(
        conn: &mut PgConnection,
        ep_set_id: i64,
    ) -> Result<ElectricalProfileSet, Box<dyn ApiError>> {
        match dsl::osrd_infra_electricalprofileset
            .find(ep_set_id)
            .first(conn)
        {
            Ok(ep_set) => Ok(ep_set),
            Err(DieselError::NotFound) => {
                Err(Box::new(ElectricalProfilesApiError::NotFound(ep_set_id)))
            }
            Err(e) => Err(Box::new(ElectricalProfilesApiError::DieselError(e))),
        }
    }

    pub fn retrieve_data(
        conn: &mut PgConnection,
        ep_set_id: i64,
    ) -> Result<ElectricalProfileSetSchema, Box<dyn ApiError>> {
        let ep_set_wrapper = Self::retrieve(conn, ep_set_id);
        match ep_set_wrapper {
            Ok(ep_set_wrapper) => {
                match serde_json::from_value::<ElectricalProfileSetSchema>(ep_set_wrapper.data) {
                    Ok(ep_set) => Ok(ep_set),
                    Err(e) => Err(Box::new(ElectricalProfilesApiError::InternalError(
                        e.to_string(),
                    ))),
                }
            }
            Err(e) => Err(e),
        }
    }

    pub fn list(
        conn: &mut PgConnection,
    ) -> Result<Vec<ElectricalProfileSetMetaData>, Box<dyn ApiError>> {
        match dsl::osrd_infra_electricalprofileset
            .select((dsl::id, dsl::name))
            .load(conn)
        {
            Ok(ep_sets) => Ok(ep_sets),
            Err(e) => Err(Box::new(ElectricalProfilesApiError::DieselError(e))),
        }
    }
}

#[derive(Debug, Error)]
pub enum ElectricalProfilesApiError {
    /// Couldn't found the infra with the given id
    #[error("Electrical Profile Set '{0}', could not be found")]
    NotFound(i64),
    #[error("An internal diesel error occurred: '{}'", .0.to_string())]
    DieselError(DieselError),
    #[error("An internal error occurred: '{}'", .0.to_string())]
    InternalError(String),
}

impl ApiError for ElectricalProfilesApiError {
    fn get_status(&self) -> Status {
        match self {
            Self::NotFound(_) => Status::NotFound,
            Self::DieselError(_) => Status::InternalServerError,
            Self::InternalError(_) => Status::InternalServerError,
        }
    }

    fn get_type(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "editoast:electrical_profiles:NotFound",
            Self::DieselError(_) => "editoast:electrical_profiles:DieselError",
            Self::InternalError(_) => "editoast:electrical_profiles:InternalError",
        }
    }

    fn extra(&self) -> Option<Map<String, Value>> {
        match self {
            ElectricalProfilesApiError::NotFound(electrical_profile_set_id) => json!({
                "electrical_profile_set_id": electrical_profile_set_id,
            })
            .as_object()
            .cloned(),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::PostgresConfig;
    use crate::views::tests::create_test_client;
    use diesel::prelude::*;
    use diesel::result::Error;
    use rocket::http::{ContentType, Status};
    use serde_json::json;

    fn test_ep_set_transaction(fn_test: fn(&mut PgConnection, ElectricalProfileSet)) {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|conn| {
            diesel::delete(dsl::osrd_infra_electricalprofileset)
                .execute(conn)
                .unwrap();

            let ep_set = ElectricalProfileSet {
                id: 1,
                name: "test".to_string(),
                data: json!({
                    "level_order": "placeholder_level_order",
                    "levels": "placeholder_levels",
                }),
            };
            diesel::insert_into(dsl::osrd_infra_electricalprofileset)
                .values(&ep_set)
                .execute(conn)
                .unwrap();

            let ep_set_2 = ElectricalProfileSet {
                id: 2,
                name: "test_2".to_string(),
                data: json!({
                    "level_order": "placeholder_level_order_2",
                    "levels": "placeholder_levels_2",
                }),
            };
            diesel::insert_into(dsl::osrd_infra_electricalprofileset)
                .values(&ep_set_2)
                .execute(conn)
                .unwrap();

            fn_test(conn, ep_set);
            Ok(())
        });
    }

    #[test]
    fn test_query_list() {
        test_ep_set_transaction(|conn, _| {
            let list = ElectricalProfileSet::list(conn).unwrap();
            assert_eq!(list.len(), 2);
            assert_eq!(list[0].id, 1);
            assert_eq!(list[0].name, "test");
            assert_eq!(list[1].id, 2);
            assert_eq!(list[1].name, "test_2");
        });
    }

    #[test]
    fn test_query_retrieve() {
        test_ep_set_transaction(|conn, ep_set_wrapper| {
            let ep_set = ElectricalProfileSet::retrieve_data(conn, ep_set_wrapper.id).unwrap();
            assert_eq!(ep_set.level_order, "placeholder_level_order");
            assert_eq!(ep_set.levels, "placeholder_levels");
        });
    }

    #[test]
    fn test_query_retrieve_not_found() {
        test_ep_set_transaction(|conn, _| {
            let ep_set = ElectricalProfileSet::retrieve_data(conn, 3);
            assert_eq!(ep_set.unwrap_err().get_status(), Status::NotFound);
        });
    }

    #[test]
    fn test_view_list() {
        let client = create_test_client();
        let response = client.get("/electrical_profile_set").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }

    #[test]
    fn test_view_get_none() {
        let client = create_test_client();
        let response = client
            .get("/electrical_profile_set/666")
            .header(ContentType::JSON)
            .dispatch();
        assert_eq!(response.status(), Status::NotFound);
    }

    #[test]
    fn test_view_get_level_order_none() {
        let client = create_test_client();
        let response = client
            .get("/electrical_profile_set/666/level_order")
            .header(ContentType::JSON)
            .dispatch();
        assert_eq!(response.status(), Status::NotFound);
    }
}
