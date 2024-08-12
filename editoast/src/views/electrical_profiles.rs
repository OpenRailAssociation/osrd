use std::collections::HashMap;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use serde::Deserialize;
use thiserror::Error;
use utoipa::IntoParams;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::ElectricalProfileSetData;
use editoast_schemas::infra::LevelValues;

use crate::error::Result;
use crate::modelsv2::electrical_profiles::ElectricalProfileSet;
use crate::modelsv2::electrical_profiles::LightElectricalProfileSet;
use crate::modelsv2::Create;
use crate::modelsv2::DeleteStatic;
use crate::modelsv2::Model;
use crate::modelsv2::Retrieve;

crate::routes! {
    "/electrical_profile_set" => {
        post_electrical_profile,
        list,
        "/{electrical_profile_set_id}" => {
            get,
            delete,
            "/level_order" => get_level_order,
        },
    },
}

editoast_common::schemas! {
    LightElectricalProfileSet,
    ElectricalProfileSet,
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct ElectricalProfileSetId {
    electrical_profile_set_id: i64,
}

/// Retrieve the list of ids and names of electrical profile sets available
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    responses(
        (status = 200, body = Vec<LightElectricalProfileSet>, description = "The list of ids and names of electrical profile sets available"),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
) -> Result<Json<Vec<LightElectricalProfileSet>>> {
    let mut conn = db_pool.get().await?;
    Ok(Json(ElectricalProfileSet::list_light(&mut conn).await?))
}

/// Return a specific set of electrical profiles
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 200, body = ElectricalProfileSetData, description = "The list of electrical profiles in the set"),
        (status = 404, body = InternalError, description = "The requested electrical profile set was not found"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<Json<ElectricalProfileSetData>> {
    let conn = &mut db_pool.get().await?;
    let ep_set = ElectricalProfileSet::retrieve_or_fail(conn, electrical_profile_set_id, || {
        ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        }
    })
    .await?;
    Ok(Json(ep_set.data))
}

/// Return the electrical profile value order for this set
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 200,
            body = HashMap<String, LevelValues>,
            description = "A dictionary mapping electrification modes to a list of electrical profiles ordered by decreasing strength",
            example = json!({
                "1500V": ["A", "B", "C"],
                "25000V": ["25000V", "22500V", "20000V"]
            })
        ),
        (status = 404, body = InternalError, description = "The requested electrical profile set was not found"),
    )
)]
async fn get_level_order(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<Json<HashMap<String, LevelValues>>> {
    let conn = &mut db_pool.get().await?;
    let ep_set = ElectricalProfileSet::retrieve_or_fail(conn, electrical_profile_set_id, || {
        ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        }
    })
    .await?;
    Ok(Json(ep_set.data.level_order))
}

/// Delete an electrical profile set
#[utoipa::path(
    delete, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 204, description = "The electrical profile was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested electrical profie was not found"),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    let deleted = ElectricalProfileSet::delete_static(conn, electrical_profile_set_id).await?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct ElectricalProfileQueryArgs {
    name: String,
}

/// import a new electrical profile set
#[utoipa::path(
    post, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileQueryArgs),
    request_body = ElectricalProfileSetData,
    responses(
        (status = 200, body = ElectricalProfileSet, description = "The list of ids and names of electrical profile sets available"),
    )
)]
async fn post_electrical_profile(
    State(db_pool): State<DbConnectionPoolV2>,
    Query(ep_set_name): Query<ElectricalProfileQueryArgs>,
    Json(data): Json<ElectricalProfileSetData>,
) -> Result<Json<ElectricalProfileSet>> {
    let ep_set = ElectricalProfileSet::changeset()
        .name(ep_set_name.name)
        .data(data);
    let conn = &mut db_pool.get().await?;
    Ok(Json(ep_set.create(conn).await?))
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

    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use std::ops::DerefMut;

    use super::*;
    use crate::modelsv2::fixtures::create_electrical_profile_set;
    use crate::views::test_app::TestAppBuilder;
    use crate::Exists;
    use editoast_schemas::infra::ElectricalProfile;
    use editoast_schemas::infra::TrackRange;

    #[rstest]
    async fn get_electrical_profile_list() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let _set_1 = create_electrical_profile_set(pool.get_ok().deref_mut()).await;
        let _set_2 = create_electrical_profile_set(pool.get_ok().deref_mut()).await;

        let response = app.get("/electrical_profile_set").await;
        response.assert_status(StatusCode::OK);
        let response: Vec<LightElectricalProfileSet> = response.json();

        assert!(response.len() >= 2);
    }

    #[rstest]
    async fn get_unexisting_electrical_profile() {
        let app = TestAppBuilder::default_app();

        let response = app.get("/electrical_profile_set/666").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(pool.get_ok().deref_mut()).await;

        let response = app
            .get(&format!(
                "/electrical_profile_set/{}",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn get_unexisting_electrical_profile_level_order() {
        let app = TestAppBuilder::default_app();

        let response = app.get("/electrical_profile_set/666/level_order").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn test_get_level_order_some() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(pool.get_ok().deref_mut()).await;

        let response = app
            .get(&format!(
                "/electrical_profile_set/{}/level_order",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::OK);
        let level_order: HashMap<String, Vec<String>> = response.json();

        assert_eq!(level_order.len(), 1);
        assert_eq!(
            level_order.get("25000V").unwrap(),
            &vec!["25000V", "22500V", "20000V"]
        );
    }

    #[rstest]
    async fn delete_unexisting_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let response = app.delete("/electrical_profile_set/666").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn delete_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(pool.get_ok().deref_mut()).await;

        let response = app
            .delete(&format!(
                "/electrical_profile_set/{}",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::NO_CONTENT);

        let exists =
            ElectricalProfileSet::exists(pool.get_ok().deref_mut(), electrical_profile_set.id)
                .await
                .expect("Failed to check if electrical profile set exists");

        assert!(!exists);
    }

    #[rstest]
    async fn test_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let ep_set = ElectricalProfileSetData {
            levels: vec![ElectricalProfile {
                value: "A".to_string(),
                power_class: "1".to_string(),
                track_ranges: vec![TrackRange::default()],
            }],
            level_order: Default::default(),
        };

        let response = app
            .post("/electrical_profile_set/?name=elec")
            .json(&ep_set)
            .await;
        response.assert_status(StatusCode::OK);
        let created_ep: ElectricalProfileSet = response.json();

        let created_ep = ElectricalProfileSet::retrieve(pool.get_ok().deref_mut(), created_ep.id)
            .await
            .expect("Failed to retrieve created electrical profile set")
            .expect("Electrical profile set not found");

        assert_eq!(created_ep.name, "elec");
    }
}
