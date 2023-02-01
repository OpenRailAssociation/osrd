use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::tables::osrd_infra_electricalprofileset;
use crate::tables::osrd_infra_electricalprofileset::dsl;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, Data, Json, Path, Query};
use actix_web::{get, post};
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::{to_value, Value as JsonValue};
use std::collections::HashMap;
use thiserror::Error;

/// Returns `/electrical_profile_set` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/electrical_profile_set").service((
        list,
        get,
        post_electrical_profile,
        get_level_order,
    ))
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
) -> Result<Json<ElectricalProfileSetData>> {
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

#[derive(Deserialize)]
struct ImportElectricalProfileSetQuery {
    name: String,
}

/// import electrical profile set
#[post("")]
async fn post_electrical_profile(
    db_pool: Data<DbPool>,
    query: Query<ImportElectricalProfileSetQuery>,
    data: Json<ElectricalProfileSetData>,
) -> Result<Json<ElectricalProfileSet>> {
    let electrical_profile_set = ElectricalProfileSet::create_electrical_profile_set(
        db_pool,
        query.into_inner().name,
        data.into_inner(),
    )
    .await
    .unwrap();
    Ok(Json(electrical_profile_set))
}

/// Return the electrical profile value order for this set
#[get("/{electrical_profile_set}/level_order")]
async fn get_level_order(
    db_pool: Data<DbPool>,
    electrical_profile_set: Path<i64>,
) -> Result<Json<HashMap<String, Vec<String>>>> {
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

#[derive(Debug, PartialEq, Queryable, Insertable, Identifiable, Serialize, Deserialize)]
#[diesel(table_name = osrd_infra_electricalprofileset)]
pub struct ElectricalProfileSet {
    pub id: i64,
    pub name: String,
    pub data: JsonValue,
}

#[derive(Debug, PartialEq, Insertable, Queryable)]
#[diesel(table_name = osrd_infra_electricalprofileset)]
struct NewElectricalProfileSet {
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

    pub async fn create_electrical_profile_set(
        db_pool: Data<DbPool>,
        name: String,
        data: ElectricalProfileSetData,
    ) -> Result<ElectricalProfileSet> {
        let data = to_value(data).unwrap();
        let ep_set = NewElectricalProfileSet { name, data };
        match block(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            diesel::insert_into(dsl::osrd_infra_electricalprofileset)
                .values(&ep_set)
                .get_result(&mut conn)
        })
        .await
        .unwrap()
        {
            Ok(ep_set) => Ok(ep_set),
            Err(e) => Err(e.into()),
        }
    }

    pub fn retrieve_data(
        conn: &mut PgConnection,
        ep_set_id: i64,
    ) -> Result<ElectricalProfileSetData> {
        let ep_set_wrapper = Self::retrieve(conn, ep_set_id)?;
        match serde_json::from_value::<ElectricalProfileSetData>(ep_set_wrapper.data) {
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
    /// Couldn't find the electrical profile set with the given id
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
    use crate::schema::electrical_profiles::ElectricalProfile;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::test::TestRequest;
    use actix_web::test::{call_service, read_body_json};
    use diesel::prelude::*;
    use diesel::result::Error;
    use serde_json::{from_value, to_value};

    use crate::tables::osrd_infra_electricalprofileset::dsl;

    use crate::schema::electrical_profiles::ElectricalProfileSetData;
    use crate::schema::TrackRange;

    fn test_ep_set_transaction(fn_test: fn(&mut PgConnection, ElectricalProfileSet)) {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|conn| {
            diesel::delete(dsl::osrd_infra_electricalprofileset).execute(conn)?;
            let ep_set_data = ElectricalProfileSetData {
                levels: vec![ElectricalProfile {
                    value: "A".to_string(),
                    power_class: "1".to_string(),
                    track_ranges: vec![TrackRange::default()],
                }],
                level_order: Default::default(),
            };
            let ep_set = ElectricalProfileSet {
                id: 1,
                name: "test".to_string(),
                data: to_value(&ep_set_data).unwrap(),
            };
            diesel::insert_into(dsl::osrd_infra_electricalprofileset)
                .values(&ep_set)
                .execute(conn)
                .unwrap();

            let ep_set_2 = ElectricalProfileSet {
                id: 2,
                name: "test_2".to_string(),
                data: to_value(&ep_set_data).unwrap(),
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
            let ep_set_data = ElectricalProfileSet::retrieve_data(conn, ep_set_wrapper.id).unwrap();
            assert_eq!(ep_set_data.levels.first().unwrap().value, "A");
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
    async fn test_post_electrical_profile() {
        let app = create_test_service().await;
        let ep_set = ElectricalProfileSetData {
            levels: vec![ElectricalProfile {
                value: "A".to_string(),
                power_class: "1".to_string(),
                track_ranges: vec![TrackRange::default()],
            }],
            level_order: Default::default(),
        };
        let req = TestRequest::post()
            .uri("/electrical_profile_set/?name=elec")
            .set_json(ep_set)
            .append_header(ContentType::json())
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let created_ep_set: ElectricalProfileSet = read_body_json(response).await;
        assert_eq!(created_ep_set.name, "elec");
        assert!(from_value::<ElectricalProfileSetData>(created_ep_set.data).is_ok());
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
