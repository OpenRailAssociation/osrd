use std::collections::HashSet;

use authz::Role;
use authz::v2;
use axum::Extension;
use axum::extract::State;
use axum::response::Json;
use database::DbConnection;
use models::Group;
use models::prelude::RetrieveBatch as _;
#[cfg(test)]
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AppState;
use crate::views::AuthorizationError;

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Debug, Deserialize, PartialEq))]
pub(in crate::views) struct WhoamiResponse {
    id: i64,
    name: String,
    #[schema(value_type = Vec<Role>)]
    roles: HashSet<Role>,
}

#[editoast_derive::route]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "Get the info of the current user",
        body = inline(WhoamiResponse),
    ))
)]
pub(in crate::views) async fn whoami(
    Extension(authn_state): Extension<crate::authentication::State>,
    Extension(user): Extension<Option<models::User>>,
) -> Result<Json<WhoamiResponse>> {
    match authn_state {
        crate::authentication::State::Skip => Err(AuthorizationError::Unauthenticated)?,
        crate::authentication::State::Authenticated { roles, .. } => {
            let user = user.expect("the user was authenticated and should therefore exist");
            let roles = HashSet::from_iter(roles);
            Ok(Json(WhoamiResponse {
                id: user.id,
                name: user.name,
                roles,
            }))
        }
    }
}

#[editoast_derive::route]
#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "Get the groups of the current user",
        body = inline(Vec<Group>),
    ))
)]
pub(in crate::views) async fn user_groups(
    Extension(authn_state): Extension<crate::authentication::State>,
    State(AppState {
        openfga, db_pool, ..
    }): State<AppState>,
) -> Result<Json<Vec<Group>>> {
    let user = authn_state
        .user()
        .ok_or(AuthorizationError::Unauthenticated)?;
    let groups =
        retrieve_user_groups(user, &authn_state, &openfga, &mut db_pool.get().await?).await?;
    Ok(Json(groups))
}

/// Returns the groups the user belongs to
pub(in crate::views) async fn retrieve_user_groups(
    user: authz::User,
    authn_state: &crate::authentication::State,
    openfga: &fga::Client,
    conn: &mut DbConnection,
) -> Result<Vec<Group>> {
    let group_ids = v2::user_groups(user)
        .run::<AuthorizationError, _>(&authn_state.authorizer(openfga))
        .await?
        .into_iter()
        .map(|authz::Group(id)| id);
    let (groups, missing_ids) = Group::retrieve_batch(conn, group_ids).await?;

    if !missing_ids.is_empty() {
        tracing::warn!(
            missing_count = missing_ids.len(),
            missing_groups_id = ?missing_ids,
            "Groups not found in database"
        );
    }

    Ok(groups)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_test() {
        let app = test_app!().build();
        let user = app
            .user("test", "test")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let user_data = app
            .get("/authz/me")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: user.id,
                name: "test".to_string(),
                roles: HashSet::from([Role::OperationalStudies]),
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_impersonation() {
        let app = test_app!().build();
        let impersonator = app
            .user("impersonator", "Impersonator")
            .with_roles([Role::Admin])
            .create()
            .await;
        let impersonated = app
            .user("impersonated", "Impersonated")
            .with_roles([Role::Stdcm])
            .create()
            .await;

        let user_data = app
            .get("/authz/me")
            .by_user(impersonator.as_ref())
            .impersonate(impersonated.as_ref())
            .await
            .assert_status_ok()
            .json::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: impersonated.id,
                name: "Impersonated".to_string(),
                roles: HashSet::from([Role::Stdcm]),
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn whoami_new_impersonator_always_forbidden() {
        let app = test_app!().build();
        let impersonated = app
            .user("impersonated", "Impersonated")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let identity = "Who's there?".to_owned();

        app.get("/authz/me")
            .by_user(&authz::identity::UserInfo {
                identities: vec![identity.clone()],
                name: "No one.".to_owned(),
            })
            .impersonate(impersonated.as_ref())
            .await
            .assert_status_forbidden();

        assert_eq!(
            models::User::retrieve_by_identity(&identity, app.db_pool().get_ok()).await,
            Ok(None),
            "new user should not be registered"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_groups_test() {
        let app = test_app!().build();
        let user_1 = app.user("test1", "test1").create().await;
        let user_2 = app.user("test2", "test2").create().await;
        let group_1 = app
            .group("group_1")
            .with_members([&user_1, &user_2])
            .create()
            .await;
        let group_2 = app.group("group_2").with_members([&user_1]).create().await;

        let mut groups_user_1 = app
            .get("/authz/me/groups")
            .by_user(user_1.as_ref())
            .await
            .assert_status_ok()
            .json::<Vec<Group>>();
        let groups_user_2 = app
            .get("/authz/me/groups")
            .by_user(user_2.as_ref())
            .await
            .assert_status_ok()
            .json::<Vec<Group>>();

        groups_user_1.sort_by_key(|g| g.id);

        assert_eq!(
            groups_user_1,
            vec![
                Group {
                    id: group_1.id,
                    name: "group_1".to_string(),
                },
                Group {
                    id: group_2.id,
                    name: "group_2".to_string(),
                }
            ]
        );
        assert_eq!(
            groups_user_2,
            vec![Group {
                id: group_1.id,
                name: "group_1".to_string(),
            }]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_groups_skip_authz() {
        let app = test_app!().build();

        // Without a user in the request
        app.get("/authz/me/groups")
            .skip_authz()
            .await
            .assert_status_unauthorized();
    }
}
