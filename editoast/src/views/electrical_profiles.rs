use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::schema::electrical_profiles::ElectricalProfileSet as ElectricalProfileSetSchema;
use crate::tables::osrd_infra_electricalprofileset;
use crate::tables::osrd_infra_electricalprofileset::dsl;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, block, Data, Json, Path};
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use editoast_derive::EditoastError;
use serde::Serialize;
use serde_json::Value as JsonValue;
use thiserror::Error;

/// Returns `/electrical_profile_set` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/electrical_profile_set").service((list, get, get_level_order))
}

/// Return a list of electrical profile sets
#[get("")]
async fn list(db_pool: Data<DbPool>) -> Result<Json<Vec<ElectricalProfileSetMetaData>>> {
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(ElectricalProfileSet::list(&mut conn)?))
    })
    .await
    .unwrap()
}

/// Return a specific set of electrical profiles
#[get("/{electrical_profile_set}")]
async fn get(
    db_pool: Data<DbPool>,
    electrical_profile_set: Path<i64>,
) -> Result<Json<ElectricalProfileSetSchema>> {
    let electrical_profile_set = electrical_profile_set.into_inner();
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(ElectricalProfileSet::retrieve_data(
            &mut conn,
            electrical_profile_set,
        )?))
    })
    .await
    .unwrap()
}

/// Return the electrical profile value order for this set
#[get("/{electrical_profile_set}/level_order")]
async fn get_level_order(
    db_pool: Data<DbPool>,
    electrical_profile_set: Path<i64>,
) -> Result<Json<JsonValue>> {
    let electrical_profile_set = electrical_profile_set.into_inner();
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(
            ElectricalProfileSet::retrieve_data(&mut conn, electrical_profile_set)?.level_order,
        ))
    })
    .await
    .unwrap()
}

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
    pub data: JsonValue,
}

impl ElectricalProfileSet {
    fn retrieve(
        conn: &mut PgConnection,
        electical_profile_set_id: i64,
    ) -> Result<ElectricalProfileSet> {
        match dsl::osrd_infra_electricalprofileset
            .find(electical_profile_set_id)
            .first(conn)
        {
            Ok(ep_set) => Ok(ep_set),
            Err(DieselError::NotFound) => Err(ElectricalProfilesError::NotFound {
                electical_profile_set_id,
            }
            .into()),
            Err(err) => Err(err.into()),
        }
    }

    pub fn retrieve_data(
        conn: &mut PgConnection,
        ep_set_id: i64,
    ) -> Result<ElectricalProfileSetSchema> {
        let ep_set_wrapper = Self::retrieve(conn, ep_set_id)?;
        match serde_json::from_value::<ElectricalProfileSetSchema>(ep_set_wrapper.data) {
            Ok(ep_set) => Ok(ep_set),
            Err(e) => Err(ElectricalProfilesError::InternalError(e.to_string()).into()),
        }
    }

    pub fn list(conn: &mut PgConnection) -> Result<Vec<ElectricalProfileSetMetaData>> {
        Ok(dsl::osrd_infra_electricalprofileset
            .select((dsl::id, dsl::name))
            .load(conn)?)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "electrical_profiles")]
pub enum ElectricalProfilesError {
    /// Couldn't found the infra with the given id
    #[error("Electrical Profile Set '{electical_profile_set_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { electical_profile_set_id: i64 },
    #[error("An internal error occurred: '{}'", .0.to_string())]
    #[editoast_error(status = 500)]
    InternalError(String),
}

#[cfg(test)]
mod tests {
    use super::ElectricalProfileSet;
    use crate::client::PostgresConfig;
    use crate::tables::osrd_infra_electricalprofileset::dsl;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use diesel::prelude::*;
    use diesel::result::Error;
    use serde_json::json;

    fn test_ep_set_transaction(fn_test: fn(&mut PgConnection, ElectricalProfileSet)) {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|conn| {
            diesel::delete(dsl::osrd_infra_electricalprofileset).execute(conn)?;

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
            assert_eq!(ep_set.unwrap_err().get_status(), StatusCode::NOT_FOUND);
        });
    }

    #[actix_test]
    async fn test_view_list() {
        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri("/electrical_profile_set")
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[actix_test]
    async fn test_view_get_none() {
        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri("/electrical_profile_set/666")
            .append_header(ContentType::json())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn test_view_get_level_order_none() {
        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri("/electrical_profile_set/666/level_order")
            .append_header(ContentType::json())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
