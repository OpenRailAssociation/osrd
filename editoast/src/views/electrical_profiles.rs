use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::models::electrical_profile::{ElectricalProfileSet, LightElectricalProfileSet};
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, Data, Json, Path, Query};
use actix_web::{get, post};
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use serde::Deserialize;
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
async fn list(db_pool: Data<DbPool>) -> Result<Json<Vec<LightElectricalProfileSet>>> {
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        Ok(Json(ElectricalProfileSet::list_light(&mut conn)?))
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
        let mut conn = db_pool.get()?;
        let ep_set = ElectricalProfileSet::retrieve(&mut conn, electrical_profile_set)?;
        Ok(Json(ep_set.data.unwrap().0))
    })
    .await
    .unwrap()
}

#[derive(Deserialize)]
struct ElectricalProfileQueryArgs {
    name: String,
}

/// import electrical profile set
#[post("")]
async fn post_electrical_profile(
    db_pool: Data<DbPool>,
    ep_set_name: Query<ElectricalProfileQueryArgs>,
    data: Json<ElectricalProfileSetData>,
) -> Result<Json<ElectricalProfileSet>> {
    let ep_set = ElectricalProfileSet {
        name: Some(ep_set_name.into_inner().name),
        data: Some(DieselJson(data.into_inner())),
        ..Default::default()
    };
    Ok(Json(ep_set.create(db_pool).await.unwrap()))
}

/// Return the electrical profile value order for this set
#[get("/{electrical_profile_set}/level_order")]
async fn get_level_order(
    db_pool: Data<DbPool>,
    electrical_profile_set: Path<i64>,
) -> Result<Json<HashMap<String, Vec<String>>>> {
    let electrical_profile_set = electrical_profile_set.into_inner();
    block(move || {
        let mut conn = db_pool.get()?;
        let ep_set = ElectricalProfileSet::retrieve(&mut conn, electrical_profile_set)?;
        Ok(Json(ep_set.data.unwrap().0.level_order))
    })
    .await
    .unwrap()
}

impl ElectricalProfileSet {
    pub fn retrieve(conn: &mut PgConnection, ep_set_id: i64) -> Result<ElectricalProfileSet> {
        use crate::tables::osrd_infra_electricalprofileset::dsl::*;
        match osrd_infra_electricalprofileset.find(ep_set_id).first(conn) {
            Ok(ep_set) => Ok(ep_set),
            Err(DieselError::NotFound) => Err(ElectricalProfilesError::NotFound {
                electical_profile_set_id: ep_set_id,
            }
            .into()),
            Err(err) => Err(err.into()),
        }
    }

    pub async fn create(self, db_pool: Data<DbPool>) -> Result<ElectricalProfileSet> {
        block(move || {
            use crate::tables::osrd_infra_electricalprofileset::dsl::*;
            let mut conn = db_pool.get()?;
            Ok(diesel::insert_into(osrd_infra_electricalprofileset)
                .values(self)
                .get_result(&mut conn)?)
        })
        .await
        .unwrap()
    }

    fn list_light(conn: &mut PgConnection) -> Result<Vec<LightElectricalProfileSet>> {
        use crate::tables::osrd_infra_electricalprofileset::dsl::*;
        Ok(osrd_infra_electricalprofileset
            .select((id, name))
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
}

#[cfg(test)]
mod tests {
    use super::ElectricalProfileSet;
    use crate::client::PostgresConfig;
    use crate::fixtures::tests::{db_pool, TestFixture};
    use crate::schema::electrical_profiles::ElectricalProfile;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::test::TestRequest;
    use actix_web::test::{call_service, read_body_json};
    use actix_web::web::Data;
    use diesel::prelude::*;
    use diesel::r2d2::ConnectionManager;
    use diesel::result::Error;
    use diesel_json::Json as DieselJson;
    use r2d2::Pool;
    use rstest::rstest;

    use crate::tables::osrd_infra_electricalprofileset::dsl;

    use crate::schema::electrical_profiles::ElectricalProfileSetData;
    use crate::schema::TrackRange;

    fn test_ep_set_transaction(fn_test: fn(&mut PgConnection)) {
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
                id: Some(1),
                name: Some("test".to_string()),
                data: Some(DieselJson::new(ep_set_data.clone())),
            };
            let ep_set_2 = ElectricalProfileSet {
                id: Some(2),
                name: Some("test_2".to_string()),
                data: Some(DieselJson::new(ep_set_data)),
            };

            diesel::insert_into(dsl::osrd_infra_electricalprofileset)
                .values(&[ep_set, ep_set_2])
                .execute(conn)
                .unwrap();

            fn_test(conn);
            Ok(())
        });
    }

    #[test]
    fn test_query_list() {
        test_ep_set_transaction(|conn| {
            let list = ElectricalProfileSet::list_light(conn).unwrap();
            assert_eq!(list.len(), 2);
            let (ep_set_1, ep_set_2) = (&list[0], &list[1]);
            assert_eq!(ep_set_1.id.unwrap(), 1);
            assert_eq!(ep_set_1.name.as_ref().unwrap(), "test");
            assert_eq!(ep_set_2.id.unwrap(), 2);
            assert_eq!(ep_set_2.name.as_ref().unwrap(), "test_2");
        });
    }

    #[test]
    fn test_query_retrieve() {
        test_ep_set_transaction(|conn| {
            let ep_set_data = ElectricalProfileSet::retrieve(conn, 1).unwrap();
            assert_eq!(
                ep_set_data.data.unwrap().0.levels.first().unwrap().value,
                "A"
            );
        });
    }

    #[test]
    fn test_query_retrieve_not_found() {
        test_ep_set_transaction(|conn| {
            let ep_set = ElectricalProfileSet::retrieve(conn, 3);
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

    #[rstest]
    async fn test_post_electrical_profile(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) {
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
        let created_ep_set = TestFixture::<ElectricalProfileSet> {
            model: read_body_json(response).await,
            db_pool,
            infra: None,
        };
        assert_eq!(created_ep_set.model.name.clone().unwrap(), "elec");
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
