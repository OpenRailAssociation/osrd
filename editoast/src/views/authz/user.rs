use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use authz::InfraPrivilege;
use authz::ProjectPrivilege;
use authz::Role;
use authz::RollingStockPrivilege;
use authz::authorizers::SystemAuthorizer;
use authz::v2;
use authz::v2::Actor;
use authz::v2::Authorizer as _;
use authz::v2::Check;
use axum::Extension;
use axum::extract::State;
use axum::response::Json;
use database::DbConnection;
use futures::TryStreamExt as _;
use itertools::Itertools as _;
use models::Group;
use models::authn::user::UserWithIdentities;
use models::prelude::*;
#[cfg(test)]
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AppState;
use crate::views::AuthorizationError;
use crate::views::authz::AuthzError;
use crate::views::authz::ResourcePrivileges;
use crate::views::authz::ResourceType;
use crate::views::authz::UserInfo;
use crate::views::authz::UsersInfoRequest;
use crate::views::authz::resources::Resource;
use crate::views::authz::resources::StandardPrivilege;
use crate::views::authz::retrieve_missing_resource_ids;

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

#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(UsersInfoRequest),
        description = "A list of user IDs and identities to get information on",
    ),
    responses((
        status = 200,
        description = "Get information on a list of users",
        body = inline(Vec<UserInfo>),
    ))
)]
pub(in crate::views) async fn users_info(
    State(AppState {
        openfga, db_pool, ..
    }): State<AppState>,
    Json(UsersInfoRequest { ids, identities }): Json<UsersInfoRequest>,
) -> Result<Json<Vec<UserInfo>>> {
    let conn = db_pool.get().await?;
    let users = {
        let (mut u1, u2) = tokio::try_join!(
            UserWithIdentities::stream_by_id(conn.clone(), &ids)
                .await?
                .try_collect::<Vec<_>>(),
            UserWithIdentities::stream_by_identity(conn.clone(), &identities)
                .await?
                .try_collect::<Vec<_>>(),
        )?;
        u1.extend(u2);
        u1
    };

    {
        let found_ids = users
            .iter()
            .map(|user| user.user.id)
            .collect::<HashSet<_>>();
        if let Some(id) = ids.into_iter().find(|id| !found_ids.contains(id)) {
            return Err(AuthzError::UnknownUser { id }.into());
        }
    }

    // Check for missing requested identities
    {
        let identities = HashSet::from_iter(identities.iter());
        let found_identities = users
            .iter()
            .flat_map(|u| u.identities.iter())
            .collect::<HashSet<_>>();
        let missing_identities = identities
            .difference(&found_identities)
            .map(std::ops::Deref::deref)
            .cloned() // &&String
            .collect::<HashSet<_>>();
        if !missing_identities.is_empty() {
            return Err(AuthzError::UnknownIdentities {
                identities: missing_identities,
            }
            .into());
        }
    }

    // Fetch groups for each user
    let groups_prots = v2::Protected::from_iter(users.into_iter().map(|user| {
        let user_groups = v2::user_groups(authz::User(user.user.id));
        v2::Protected::value(user).zip(user_groups)
    }));
    let system = SystemAuthorizer::new_infallible(&openfga);
    let Ok(user_groups) = system.authorize(groups_prots).await?.access().await?;

    // Find groups that really exist (OpenFGA can be out of sync sometimes)
    let group_by_id = {
        let group_ids = user_groups
            .iter()
            .flat_map(|(_, groups)| groups.iter().map(|g| **g))
            .collect_vec();
        let settings = SelectionSettings::new().filter(move || Group::ID.eq_any(group_ids.clone()));
        let groups = Group::list(&mut db_pool.get().await?, settings).await?;
        Arc::new(
            groups
                .into_iter()
                .map(|g| (g.id, g))
                .collect::<HashMap<_, _>>(),
        )
    };

    // Fetch roles and build the response
    let Ok(results) = v2::Protected::from_iter(user_groups.into_iter().map(
        |(
            UserWithIdentities {
                user: models::User { id, name },
                identities,
            },
            groups,
        )| {
            let group_by_id = group_by_id.clone();
            v2::subject_roles(authz::Subject::user(id)).map(async move |roles| {
                UserInfo {
                    id,
                    name,
                    identities,
                    roles: HashSet::from_iter(roles),
                    groups: groups
                        .into_iter()
                        // Skip group if it does not exist
                        .filter_map(|g| group_by_id.get(&*g).cloned())
                        .collect(),
                }
            })
        },
    ))
    .authorize(&system)
    .await?
    .access()
    .await?;

    Ok(Json(results))
}

#[editoast_derive::route]
#[utoipa::path(
    post,
    path = "",
    tag = "authz",
    request_body(
        content = inline(HashMap<ResourceType, Vec<i64>>),
        description = "The resources of which to get the request sender's privileges.",
    ),
    responses((
        status = 200,
        description = "The privileges of the user sending the request over each requested resource. \
        The resource is omitted if it does not exist. \
        An empty privileges list is returned if the user has no privileges over it.",
        body = inline(HashMap<ResourceType, Vec<ResourcePrivileges>>)
    )),
)]
pub(in crate::views) async fn user_privileges(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Json(resources_ids): Json<HashMap<ResourceType, Vec<i64>>>,
) -> Result<Json<HashMap<ResourceType, Vec<ResourcePrivileges>>>> {
    let mut result = HashMap::<_, Vec<_>>::new();
    let missing_resources = retrieve_missing_resource_ids(
        db_pool.get().await?,
        resources_ids.iter().flat_map(|(resource_type, ids)| {
            std::iter::repeat(*resource_type).zip(ids.iter().copied())
        }),
    )
    .await?;

    match &authn_state {
        crate::authentication::State::Authenticated { user, .. } => {
            let resources = resources_ids.into_iter().flat_map(|(resource_type, ids)| {
                let missing_ids = &missing_resources[&resource_type];
                // Missing resources are not an error under this API: omit them before authorization.
                ids.into_iter()
                    .filter(|id| !missing_ids.contains(id))
                    .map(move |id| match resource_type {
                        ResourceType::Infra => Resource::Infra(authz::Infra(id)),
                        ResourceType::RollingStock => {
                            Resource::RollingStock(authz::RollingStock(id))
                        }
                        ResourceType::Project => Resource::Project(authz::Project(id)),
                    })
            });
            let protected_privileges = resources.into_iter().map(|resource| match resource {
                resource @ Resource::Infra(infra) => v2::infra_privileges(*user, infra)
                    .collect_into::<HashSet<StandardPrivilege>>()
                    .zip(v2::Protected::value(resource)),
                resource @ Resource::RollingStock(rolling_stock) => {
                    v2::rolling_stock_privileges(*user, rolling_stock)
                        .collect_into::<HashSet<StandardPrivilege>>()
                        .zip(v2::Protected::value(resource))
                }
                resource @ Resource::Project(project) => v2::project_privileges(*user, project)
                    .collect_into::<HashSet<StandardPrivilege>>()
                    .zip(v2::Protected::value(resource)),
            });
            let authorizer = authn_state.authorizer(&openfga);
            let accesses = authorizer.authorize_all(protected_privileges).await?;
            for access in v2::Access::access_all(accesses).await? {
                match access {
                    Ok((privileges, resource)) => {
                        result
                            .entry(resource.get_type())
                            .or_default()
                            .push(ResourcePrivileges {
                                resource_id: resource.id(),
                                privileges,
                            });
                    }
                    Err(Check::HasInfraPrivilege(
                        Actor::Issuer,
                        InfraPrivilege::CanRestrictedRead,
                        infra,
                    )) => {
                        result
                            .entry(ResourceType::Infra)
                            .or_default()
                            .push(ResourcePrivileges {
                                resource_id: *infra,
                                privileges: HashSet::new(),
                            });
                    }
                    Err(Check::HasRollingStockPrivilege(
                        Actor::Issuer,
                        RollingStockPrivilege::CanRestrictedRead,
                        rolling_stock,
                    )) => {
                        result.entry(ResourceType::RollingStock).or_default().push(
                            ResourcePrivileges {
                                resource_id: *rolling_stock,
                                privileges: HashSet::new(),
                            },
                        );
                    }
                    Err(Check::HasProjectPrivilege(
                        Actor::Issuer,
                        ProjectPrivilege::HasAccess,
                        project,
                    )) => {
                        result
                            .entry(ResourceType::Project)
                            .or_default()
                            .push(ResourcePrivileges {
                                resource_id: project.0,
                                privileges: HashSet::new(),
                            })
                    }
                    Err(_) => return Err(AuthorizationError::Forbidden.into()),
                }
            }
        }
        crate::authentication::State::Skip => {
            let privileges = HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ]);
            let project_privilege = HashSet::from([StandardPrivilege::HasAccess]);
            for (resource_type, ids) in resources_ids {
                let missing_ids = &missing_resources[&resource_type];
                result.entry(resource_type).or_default().extend(
                    ids.into_iter()
                        .filter(|id| !missing_ids.contains(id))
                        .map(|resource_id| ResourcePrivileges {
                            resource_id,
                            privileges: if resource_type == ResourceType::Project {
                                project_privilege.clone()
                            } else {
                                privileges.clone()
                            },
                        }),
                );
            }
        }
    }
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use authz::InfraGrant;
    use authz::ProjectGrant;
    use models::Infra;
    use models::Project;
    use serde_json::json;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_project;
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn users_info() {
        let app = test_app!().build();
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        let user_1 = app
            .user("user_1", "User 1")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let user_2 = app
            .user("user_2", "User 2")
            .with_roles([Role::Stdcm])
            .create()
            .await;
        let group_1 = app
            .group("group_1")
            .with_members([&user_1, &user_2])
            .create()
            .await;
        let group_2 = app.group("group_2").with_members([&user_2]).create().await;

        let mut users_info = app
            .post("/authz/user/info")
            .by_user(admin.as_ref())
            .json(&json!({
                "ids": [user_1.id],
                "identities": [user_2.info.identities[0].clone()],
            }))
            .await
            .assert_status_ok()
            .json::<Vec<UserInfo>>();

        users_info.sort_by_key(|user| user.id);

        assert_eq!(
            users_info,
            vec![
                UserInfo {
                    id: user_1.id,
                    name: user_1.info.name,
                    identities: user_1.info.identities,
                    roles: HashSet::from([Role::OperationalStudies]),
                    groups: HashSet::from([Group {
                        id: group_1.id,
                        name: group_1.info.name.clone(),
                    }]),
                },
                UserInfo {
                    id: user_2.id,
                    name: user_2.info.name,
                    identities: user_2.info.identities,
                    roles: HashSet::from([Role::Stdcm]),
                    groups: HashSet::from([
                        Group {
                            id: group_1.id,
                            name: group_1.info.name,
                        },
                        Group {
                            id: group_2.id,
                            name: group_2.info.name,
                        },
                    ]),
                },
            ]
        );

        app.post("/authz/user/info")
            .by_user(admin.as_ref())
            .json(&json!({ "ids": [i64::MAX] }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges() {
        let app = test_app!().build();
        let Infra { id: infra1, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra2, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra3, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra4, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra {
            id: infra_unused, ..
        } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Project { id: project1, .. } =
            create_project(&mut app.db_pool().get_ok(), "project1").await;
        let Project { id: project2, .. } =
            create_project(&mut app.db_pool().get_ok(), "project2").await;
        let Project {
            id: project_unused, ..
        } = create_project(&mut app.db_pool().get_ok(), "project_unused").await;
        let toto = app
            .user("toto", "Toto")
            .with_infra_grant(infra1, InfraGrant::Owner)
            .with_infra_grant(infra2, InfraGrant::Writer)
            .with_infra_grant(infra3, InfraGrant::Reader)
            .with_project_grant(project1, ProjectGrant::Owner)
            .create()
            .await;

        let mut privileges = app
            .post("/authz/me/privileges")
            .by_user(toto.as_ref())
            .json(&json!({
               "infra": [infra1, infra2, infra3, infra4, i64::MAX],
               "project": [project1, project2, i64::MAX],
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>();
        let mut infra_privileges = privileges
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            infra_privileges.remove(&infra1).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );
        assert_eq!(
            infra_privileges.remove(&infra2).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
            ])
        );
        assert_eq!(
            infra_privileges.remove(&infra3).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead
            ])
        );
        assert_eq!(infra_privileges.remove(&infra4).unwrap(), HashSet::from([]));
        assert!(!infra_privileges.contains_key(&infra_unused));
        assert!(!infra_privileges.contains_key(&i64::MAX));

        let mut project_privileges = privileges
            .remove(&ResourceType::Project)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            project_privileges.remove(&project1).unwrap(),
            HashSet::from([StandardPrivilege::HasAccess])
        );
        assert_eq!(
            project_privileges.remove(&project2).unwrap(),
            HashSet::from([])
        );
        assert!(!project_privileges.contains_key(&project_unused));
        assert!(!project_privileges.contains_key(&i64::MAX));
    }

    // TODO: merge with the previous test once test deadlocks are fixed
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_bis() {
        let app = test_app!().build();
        let Infra { id: infra1, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra2, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra3, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra { id: infra4, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Infra {
            id: infra_unused, ..
        } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let tata = app
            .user("tata", "Tata")
            .with_infra_grant(infra1, InfraGrant::Reader)
            .with_infra_grant(infra3, InfraGrant::Reader)
            .with_infra_grant(infra4, InfraGrant::Owner)
            .create()
            .await;

        let mut privileges = app
            .post("/authz/me/privileges")
            .by_user(tata.as_ref())
            .json(&json!({
               "infra": [infra1, infra2, infra3, infra4]
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>()
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            privileges.remove(&infra1).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead
            ])
        );
        assert_eq!(privileges.remove(&infra2).unwrap(), HashSet::from([]));
        assert_eq!(
            privileges.remove(&infra3).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
            ])
        );
        assert_eq!(
            privileges.remove(&infra4).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanShareRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );
        assert!(!privileges.contains_key(&infra_unused));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn me_privileges_skip_authz() {
        let app = test_app!().build();
        let Infra { id: infra, .. } = create_empty_infra(&mut app.db_pool().get_ok()).await;
        let Project { id: project, .. } =
            create_project(&mut app.db_pool().get_ok(), "project").await;
        let mut privileges = app
            .post("/authz/me/privileges")
            .skip_authz()
            .json(&json!({
               "infra": [infra],
               "project": [project]
            }))
            .await
            .assert_status_ok()
            .json::<HashMap<ResourceType, Vec<ResourcePrivileges>>>();
        let mut infra_privileges = privileges
            .remove(&ResourceType::Infra)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            infra_privileges.remove(&infra).unwrap(),
            HashSet::from([
                StandardPrivilege::CanRestrictedRead,
                StandardPrivilege::CanRead,
                StandardPrivilege::CanShareRead,
                StandardPrivilege::CanWrite,
                StandardPrivilege::CanShareWrite,
                StandardPrivilege::CanDelete,
                StandardPrivilege::CanShareOwnership,
                StandardPrivilege::CanRevoke,
            ])
        );

        let mut project_privileges = privileges
            .remove(&ResourceType::Project)
            .unwrap()
            .into_iter()
            .map(
                |ResourcePrivileges {
                     resource_id,
                     privileges,
                 }| (resource_id, privileges),
            )
            .collect::<HashMap<_, _>>();
        assert_eq!(
            project_privileges.remove(&project).unwrap(),
            HashSet::from([StandardPrivilege::HasAccess])
        )
    }
}
