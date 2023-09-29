use crate::error::Result;
use crate::models::electrical_profile::{ElectricalProfileSet, LightElectricalProfileSet};
use crate::models::{Create, Retrieve};
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::DbPool;
use crate::DieselJson;

use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, Data, Json, Path, Query};
use actix_web::{get, post};
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
    let mut conn = db_pool.get().await?;
    Ok(Json(ElectricalProfileSet::list_light(&mut conn).await?))
}

/// Return a specific set of electrical profiles
#[get("/{electrical_profile_set}")]
async fn get(
    db_pool: Data<DbPool>,
    electrical_profile_set: Path<i64>,
) -> Result<Json<ElectricalProfileSetData>> {
    let electrical_profile_set_id = electrical_profile_set.into_inner();
    let ep_set = ElectricalProfileSet::retrieve(db_pool, electrical_profile_set_id)
        .await?
        .ok_or(ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        })?;
    Ok(Json(ep_set.data.unwrap().0))
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
    let electrical_profile_set_id = electrical_profile_set.into_inner();
    let ep_set = ElectricalProfileSet::retrieve(db_pool, electrical_profile_set_id)
        .await?
        .ok_or(ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        })?;
    Ok(Json(ep_set.data.unwrap().0.level_order))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "electrical_profiles")]
pub enum ElectricalProfilesError {
    /// Couldn't find the electrical profile set with the given id
    #[error("Electrical Profile Set '{electrical_profile_set_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { electrical_profile_set_id: i64 },
}

#[cfg(test)]
mod tests {
    use super::ElectricalProfileSet;
    use crate::client::PostgresConfig;
    use crate::fixtures::tests::{db_pool, TestFixture};
    use crate::models::Retrieve;
    use crate::schema::electrical_profiles::ElectricalProfile;
    use crate::views::tests::create_test_service;
    use crate::DbPool;
    use actix_http::StatusCode;
    use actix_web::http::header::ContentType;
    use actix_web::test as actix_test;
    use actix_web::test::TestRequest;
    use actix_web::test::{call_service, read_body_json};
    use actix_web::web::Data;
    use diesel::result::Error;
    use diesel_async::scoped_futures::{ScopedBoxFuture, ScopedFutureExt};
    use diesel_async::{AsyncConnection, AsyncPgConnection as PgConnection, RunQueryDsl};
    use diesel_json::Json as DieselJson;
    use rstest::rstest;

    use crate::tables::electrical_profile_set::dsl;

    use crate::schema::electrical_profiles::ElectricalProfileSetData;
    use crate::schema::TrackRange;

    async fn test_ep_set_transaction<'a, F>(fn_test: F)
    where
        F: for<'r> FnOnce(&'r mut PgConnection) -> ScopedBoxFuture<'a, 'r, ()> + Send + 'a,
    {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url())
            .await
            .unwrap();
        let _ = conn
            .test_transaction::<_, Error, _>(|conn| {
                async move {
                    diesel::delete(dsl::electrical_profile_set)
                        .execute(conn)
                        .await?;
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

                    diesel::insert_into(dsl::electrical_profile_set)
                        .values(&[ep_set, ep_set_2])
                        .execute(conn)
                        .await
                        .unwrap();

                    fn_test(conn).await;
                    Ok(())
                }
                .scope_boxed()
            })
            .await;
    }

    #[rstest]
    async fn test_query_list() {
        test_ep_set_transaction(|conn| {
            async {
                let list = ElectricalProfileSet::list_light(conn).await.unwrap();
                assert_eq!(list.len(), 2);
                let (ep_set_1, ep_set_2) = (&list[0], &list[1]);
                assert_eq!(ep_set_1.id.unwrap(), 1);
                assert_eq!(ep_set_1.name.as_ref().unwrap(), "test");
                assert_eq!(ep_set_2.id.unwrap(), 2);
                assert_eq!(ep_set_2.name.as_ref().unwrap(), "test_2");
            }
            .scope_boxed()
        })
        .await;
    }

    #[rstest]
    async fn test_query_retrieve() {
        test_ep_set_transaction(|conn| {
            async {
                let ep_set = ElectricalProfileSet::retrieve_conn(conn, 1).await.unwrap();
                let ep_set_data = ep_set.unwrap().data.unwrap();
                assert_eq!(ep_set_data.0.levels[0].value, "A");
            }
            .scope_boxed()
        })
        .await;
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
    async fn test_post_electrical_profile(db_pool: Data<DbPool>) {
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
