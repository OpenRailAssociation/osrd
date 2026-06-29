use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use database::DbConnectionPoolV2;
use schemas::primitives::BoundingBox;
use std::sync::Arc;

use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use editoast_models::Infra;
use editoast_models::prelude::*;

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(
        InfraIdParam
    ),
    responses(
        (status = 200, body = BoundingBox, description = "The Bounding Box of the infra")
    )
)]
pub(in crate::views) async fn get_infra_bbox(
    Path(infra_id): Path<i64>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<Option<BoundingBox>>> {
    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    Ok(Json(infra.get_bounding_box(&mut conn).await?.and_then(
        |bbox_geo| BoundingBox::from_geometry(bbox_geo).ok(),
    )))
}

#[cfg(test)]
pub mod tests {
    use authz::Role;
    use schemas::primitives::BoundingBox;

    use crate::{
        fixtures::{create_empty_infra, create_small_infra},
        generated_data::InfraGeneratedData,
        infra_cache::InfraCache,
        views::test_app::{TestRequestExt as _, test_app},
    };

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn bbox_empty_infra() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let mut empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let cache = InfraCache::load(&mut db_pool.get_ok(), &empty_infra)
            .await
            .unwrap();
        let user = app
            .user("test", "Test")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(empty_infra.id, authz::InfraGrant::Reader)
            .create()
            .await;

        assert!(empty_infra.refresh(db_pool, false, &cache).await.unwrap());
        let response: Option<BoundingBox> = app
            .get(&format!("/infra/{}/bbox", empty_infra.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn bbox_small_infra() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let mut small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let user = app
            .user("test", "Test")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(small_infra.id, authz::InfraGrant::Reader)
            .create()
            .await;

        assert!(small_infra.refresh(db_pool, false, &cache).await.unwrap());
        let response: Option<BoundingBox> = app
            .get(&format!("/infra/{}/bbox", small_infra.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            Some(BoundingBox {
                min_lon: -0.4,
                min_lat: 49.466,
                max_lon: -0.09,
                max_lat: 49.51299999999999
            })
        );
    }
}
