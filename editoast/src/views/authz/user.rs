use std::collections::HashSet;

use authz::Role;
use axum::Extension;
use axum::response::Json;
#[cfg(test)]
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
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
}
