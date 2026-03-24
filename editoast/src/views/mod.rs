mod authz;
mod catalog_entry;
mod documents;
pub mod electrical_profiles;
pub mod fonts;
pub mod infra;
mod layers;
mod level_crossing_occupancy;
mod openapi;
pub mod operational_studies;
pub mod pagination;
pub mod params;
pub mod path;
pub mod project;
pub mod projection;
pub mod rolling_stock;
pub mod round_trips;
mod router;
pub mod scenario;
pub mod search;
pub mod sprites;
pub mod stdcm_search_environment;
pub mod study;
pub mod sub_categories;
pub mod temporary_speed_limits;
pub mod timetable;
mod train_schedule_set;
pub mod work_schedules;
mod worker_load;

#[cfg(test)]
mod test_app;
use ::authz::Authorization;
use ::authz::Infra;
use ::authz::StorageDriver;
use ::authz::v2::special_authorizers;
use axum::Extension;
use common::Version;
use fga::client::Limits;
#[cfg(test)]
use test_app::test_app;
use tracing::Instrument;

use ::core::str;
use std::collections::HashSet;
use std::convert::Infallible;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use ::authz::Authorizer;
use ::authz::Role;
use ::authz::identity::UserInfo;
use axum::Router;
use axum::ServiceExt;
use axum::extract::DefaultBodyLimit;
use axum::extract::FromRef;
use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use axum_tracing_opentelemetry::middleware::OtelInResponseLayer;
use chrono::Duration;
use dashmap::DashMap;

use futures::TryFutureExt;
pub use openapi::OpenApiRoot;

use axum::extract::Json;
use axum::extract::State;
use core_client::CoreClient;
use core_client::mq_client;
use database::DbConnectionPoolV2;
use database::db_connection_pool::ping_database;
use editoast_derive::EditoastError;
use thiserror::Error;
use tokio::time::timeout;
use tower::Layer as _;
use tower_http::cors::Any;
use tower_http::cors::CorsLayer;
use tower_http::decompression::RequestDecompressionLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::normalize_path::NormalizePath;
use tower_http::normalize_path::NormalizePathLayer;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing::warn;
use url::Url;

use crate::authentication::AuthenticationParameters;
use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use editoast_models::PgAuthDriver;
use editoast_models::map::MapLayers;

fn service_router() -> router::DocumentedRouter {
    use router::delete;
    use router::get;
    use router::patch;
    use router::post;
    use router::put;

    // This whole expression has been designed to be as compact as possible, keep paths relatively aligned,
    // while also keeping rustfmt happy.
    // - the closure incites rustfmt to not break line after the path
    // - the nests function name is 5 characters long to be symmetric to route (unlike axum::Router::nest)
    // - the closure parameter is named path to incite rustfmt to keep the first route call on the same line
    //   - a longer name would cause a line break before the first .
    //   - a shorter name breaks alignment
    //
    // # Ordering
    //
    // - arbitrary toplevel sections
    // - for sub routers, routes first, nests second
    // - paths ordered by number of segments
    // - equal number of segments in a path => alphabetical order
    //
    // Of course, these conventions are to be broken if they get in the way of request path resolution.

    router::DocumentedRouter::root(|path| {
        path
            //
            // random stuff
            //
            .route("/health", get!(health))
            .route("/version", get!(version))
            .route("/worker_load", post!(worker_load::worker_load))
            //
            // authorization
            //
            .nests("/authz", |path| {
                path.route("/grants", post!(authz::update_grants))
                    .route(
                        "/{resource_type}/{resource_id}",
                        get!(authz::subjects_with_grant_on_resource),
                    )
                    .nests("/me", |path| {
                        path.route("/", get!(authz::whoami))
                            .route("/groups", get!(authz::user_groups))
                            .route("/grants", post!(authz::user_grants))
                            .route("/privileges", post!(authz::user_privileges))
                    })
                    .nests("/user", |path| {
                        path.route("/info", post!(authz::users_info))
                    })
                    .route("/groups", get!(authz::list_groups))
            })
            //
            // infra & map
            //
            .route("/fonts/{font}/{glyph}", get!(fonts::fonts))
            .nests("/layers", |path| {
                path.route(
                    "/layer/{layer_slug}/mvt/{view_slug}",
                    get!(layers::layer_view),
                )
                .route(
                    "/tile/{layer_slug}/{view_slug}/{z}/{x}/{y}",
                    get!(layers::cache_and_get_mvt_tile),
                )
            })
            .nests("/sprites", |path| {
                path.route("/signaling_systems", get!(sprites::signaling_systems))
                    .route("/{signaling_system}/{file_name}", get!(sprites::sprites))
            })
            .route("/search", post!(search::search))
            .nests("/infra", |path| {
                path.route("/", get!(infra::list))
                    .route("/", post!(infra::create))
                    .route("/railjson", post!(infra::railjson::post_railjson))
                    .route("/refresh", post!(infra::refresh))
                    .route("/voltages", get!(infra::get_all_voltages))
                    .nests("/{infra_id}", |path| {
                        path.route("/", get!(infra::get))
                            .route("/", post!(infra::edition::edit))
                            .route("/", delete!(infra::delete))
                            .route("/", put!(infra::put))
                            .route("/auto_fixes", get!(infra::auto_fixes::list_auto_fixes))
                            .route("/clone", post!(infra::clone))
                            .route(
                                "/delimited_area",
                                get!(infra::delimited_area::delimited_area),
                            )
                            .route("/errors", get!(infra::errors::list_errors))
                            .route("/lock", post!(infra::lock))
                            .route(
                                "/match_operational_points",
                                post!(infra::match_operational_points),
                            )
                            .route("/path_properties", post!(path::properties::post))
                            .route("/railjson", get!(infra::railjson::get_railjson))
                            .route("/speed_limit_tags", get!(infra::get_speed_limit_tags))
                            .route(
                                "/split_track_section",
                                post!(infra::edition::split_track_section),
                            )
                            .route("/switch_types", get!(infra::get_switch_types))
                            .route("/unlock", post!(infra::unlock))
                            .route("/voltages", get!(infra::get_voltages))
                            .route("/attached/{track_id}", get!(infra::attached::attached))
                            .route("/lines/{line_code}/bbox", get!(infra::lines::get_line_bbox))
                            .nests("/pathfinding", |path| {
                                path.route("/", post!(infra::pathfinding::pathfinding_view))
                                    .route("/blocks", post!(path::pathfinding::post))
                            })
                            .nests("/routes", |path| {
                                path.route("/nodes", post!(infra::routes::get_routes_nodes))
                                    .route(
                                        "/track_ranges",
                                        get!(infra::routes::get_routes_track_ranges),
                                    )
                                    .route(
                                        "/{waypoint_type}/{waypoint_id}",
                                        get!(infra::routes::get_routes_from_waypoint),
                                    )
                            })
                            .nests("/objects/{object_type}", |path| {
                                path.route("/", post!(infra::objects::get_objects))
                                    .route("/ids", get!(infra::objects::list_objects_ids))
                            })
                    })
            })
            //
            // timetable & simulations
            //
            .nests("/timetable", |path| {
                path.route("/", post!(timetable::post))
                    .nests("/{id}", |path| {
                        path.route("/", delete!(timetable::delete))
                            .route(
                                "/train_schedule_sets",
                                get!(timetable::get_train_schedule_sets_from_timetable),
                            )
                            .route(
                                "/train_schedule_sets",
                                post!(timetable::set_links_train_schedule_sets_to_timetable),
                            )
                            .route(
                                "/train_schedule_exception",
                                post!(timetable::train_schedule_exceptions::create_train_schedule_exception),
                            )
                            .route("/conflicts", get!(timetable::conflicts))
                            .route("/requirements", get!(timetable::requirements))
                            .route("/stdcm", post!(timetable::stdcm::stdcm))
                            .nests("/train_schedules", |path| {
                                path.route("/", get!(timetable::get_train_schedules))
                            })
                            .nests("/round_trips", |path| {
                                path.route("/train_schedules", get!(round_trips::list_train_schedules))
                            })
                    })
            })
            //
            // train schedule exception
            //
            .nests("/train_schedule_exceptions", |path| {
                path.route(
                    "/delete",
                    post!(timetable::train_schedule_exceptions::delete),
                )
            })
            .route(
                "/similar_trains",
                post!(timetable::similar_trains::similar_trains),
            )
            .nests("/train_schedule_exception", |path| {
                path.route("/{id}", put!(timetable::train_schedule_exceptions::update))
            })
            .nests("/train_schedules", |path| {
                path.route(
                        "/move",
                        patch!(
                            timetable::train_schedule::move_train_schedules_to_another_train_schedule_set
                        ))
                    .route(
                        "/simulation_summary",
                        post!(timetable::train_schedule::simulation_summary),
                    )
                    .route(
                        "/track_occupancy",
                        post!(timetable::train_schedule::track_occupancy),
                    )
                    .route(
                        "/occupancy_blocks",
                        post!(timetable::train_schedule::occupancy_blocks),
                    )
                    .route("/", delete!(timetable::train_schedule::delete))
                    .route("/project_path", post!(timetable::train_schedule::project_path))
                    .route(
                        "/project_path_op",
                        post!(timetable::train_schedule::project_path_op),
                    )
                .nests("/{id}", |path| {
                    path.route("/", get!(timetable::train_schedule::get_by_id))
                        .route(
                                "/etcs_braking_curves",
                                get!(timetable::train_schedule::etcs_braking_curves),
                            )
                        .route("/", put!(timetable::train_schedule::update_train_schedule))
                        .route("/path", get!(timetable::train_schedule::get_path))
                        .route("/simulation", get!(timetable::train_schedule::simulation))
                })
            })
            .nests("/round_trips", |path| {
                path.nests("/train_schedules", |path| {
                    path.route("/", post!(round_trips::post_train_schedules))
                        .route("/delete", post!(round_trips::delete_train_schedules))
                })
            })
            .nests("/sub_category", |path| {
                path.route("/", get!(sub_categories::get_sub_categories))
                    .route("/", post!(sub_categories::create_sub_categories))
                    .nests("/{code}", |path| {
                        path.route("/", delete!(sub_categories::delete_sub_category))
                    })
            })
            //
            // simulation environment
            //
            .nests("/stdcm/search_environment", |path| {
                path.route("/", get!(stdcm_search_environment::retrieve_latest))
                    .route("/", post!(stdcm_search_environment::create))
                    .route("/list", get!(stdcm_search_environment::list))
                    .route("/{env_id}", delete!(stdcm_search_environment::delete))
            })
            .nests("/work_schedules", |path| {
                path.route("/", post!(work_schedules::create))
                    .route("/project_path", post!(work_schedules::project_path))
                    .nests("/group", |path| {
                        path.route("/", get!(work_schedules::list_groups))
                            .route("/", post!(work_schedules::create_group))
                            .nests("/{id}", |path| {
                                path.route("/", get!(work_schedules::get_group))
                                    .route("/", delete!(work_schedules::delete_group))
                                    .route("/", put!(work_schedules::put_in_group))
                            })
                    })
            })
            .route(
                "/temporary_speed_limit_group",
                post!(temporary_speed_limits::create_temporary_speed_limit_group),
            )
            .nests("/electrical_profile_set", |path| {
                path.route("/", get!(electrical_profiles::list))
                    .route("/", post!(electrical_profiles::post_electrical_profile))
                    .nests("/{electrical_profile_set_id}", |path| {
                        path.route("/", get!(electrical_profiles::get))
                            .route("/", delete!(electrical_profiles::delete))
                            .route("/level_order", get!(electrical_profiles::get_level_order))
                    })
            })
            //
            // operational studies
            //
            .nests("/documents", |path| {
                path.route("/", post!(documents::post))
                    .nests("/{document_key}", |path| {
                        path.route("/", get!(documents::get))
                            .route("/", delete!(documents::delete))
                    })
            })
            .nests("/projects", |path| {
                path.route("/", post!(project::create))
                    .route("/", get!(project::list))
                    .nests("/{project_id}", |path| {
                        path.route("/", get!(project::get))
                            .route("/", delete!(project::delete))
                            .route("/", patch!(project::patch))
                    })
            })
            .nests("/studies", |path| {
                path.route("/", post!(study::create))
                    .route("/", get!(study::list))
                    .nests("/{study_id}", |path| {
                        path.route("/", get!(study::get))
                            .route("/", delete!(study::delete))
                            .route("/", patch!(study::patch))
                    })
            })
            .nests("/scenarios", |path| {
                path.route("/", post!(scenario::create))
                    .route("/", get!(scenario::list))
                    .nests("/{scenario_id}", |path| {
                        path.route("/", get!(scenario::get))
                            .route("/", delete!(scenario::delete))
                            .route("/", patch!(scenario::patch))
                    })
            })
            .nests("/macro_nodes", |path| {
                path.route("/", get!(scenario::macro_nodes::list))
                    .route("/", post!(scenario::macro_nodes::create))
                    .nests("/{node_id}", |path| {
                        path.route("/", get!(scenario::macro_nodes::get))
                            .route("/", put!(scenario::macro_nodes::update))
                            .route("/", delete!(scenario::macro_nodes::delete))
                    })
            })
            .nests("/macro_notes", |path| {
                path.route("/", get!(scenario::macro_notes::list))
                    .route("/", post!(scenario::macro_notes::create))
                    .nests("/{note_id}", |path| {
                        path.route("/", get!(scenario::macro_notes::get))
                            .route("/", put!(scenario::macro_notes::update))
                            .route("/", delete!(scenario::macro_notes::delete))
                    })
            })
            //
            // rolling stock
            //
            .nests("/rolling_stock", |path| {
                path.route("/", post!(rolling_stock::create))
                    .route(
                        "/power_restrictions",
                        get!(rolling_stock::get_power_restrictions),
                    )
                    // /!\ Order
                    .nests("/name/{rolling_stock_name}", |path| {
                        path.route("/", get!(rolling_stock::get_by_name))
                    })
                    .nests("/{rolling_stock_id}", |path| {
                        path.route("/", get!(rolling_stock::get))
                            .route("/", put!(rolling_stock::update))
                            .route("/", delete!(rolling_stock::delete))
                            .route("/locked", patch!(rolling_stock::update_locked))
                            .route("/livery", post!(rolling_stock::create_livery))
                            .route("/usage", get!(rolling_stock::get_usage))
                    })
            })
            .nests("/light_rolling_stock", |path| {
                path.route("/", get!(rolling_stock::light::list))
                    // /!\ Order
                    .route(
                        "/name/{rolling_stock_name}",
                        get!(rolling_stock::light::get_by_name),
                    )
                    .route("/{rolling_stock_id}", get!(rolling_stock::light::get))
            })
            .nests("/towed_rolling_stock", |path| {
                path.route("/", get!(rolling_stock::towed::get_list))
                    .route("/", post!(rolling_stock::towed::post))
                    .nests("/{towed_rolling_stock_id}", |path| {
                        path.route("/", get!(rolling_stock::towed::get_by_id))
                            .route("/", put!(rolling_stock::towed::put_by_id))
                            .route("/locked", patch!(rolling_stock::towed::patch_by_id_locked))
                    })
            })
            //
            // train schedule sets & catalog entries
            //
            .nests("/train_schedule_sets", |path| {
                path.route("/", get!(train_schedule_set::get))
                    .route("/", post!(train_schedule_set::post))
                    .nests("/{id}", |path| {
                        path.route("/", get!(train_schedule_set::get_by_id))
                            .route("/", put!(train_schedule_set::put))
                            .route("/", delete!(train_schedule_set::delete))
                            .route("/train_schedules", get!(train_schedule_set::get_train_schedules))
                            .route(
                                "/train_schedules",
                                post!(train_schedule_set::post_train_schedule),
                            )
                    })
            })
            .nests("/catalog_entries", |path| {
                path.route("/", get!(catalog_entry::list_paginated))
                    .route("/", post!(catalog_entry::post))
                    .nests("/{id}", |path| {
                        {
                            path.route("/", put!(catalog_entry::put))
                                .route("/", delete!(catalog_entry::delete))
                        }
                    })
            })
            //
            // level_crossings
            //
            .route(
                "/level_crossing_occupancy",
                post!(level_crossing_occupancy::occupancy),
            )
    })
}

async fn authentication_extraction_middleware(mut req: Request, next: Next) -> Result<Response> {
    const IDENTITY: &str = "x-remote-user-identity";
    const NAME: &str = "x-remote-user-name";
    const SKIP_AUTHZ: &str = "x-osrd-skip-authz";
    const IMPERSONATE: &str = "x-impersonate";

    let headers = req.headers();
    let identity = headers.get(IDENTITY).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-identity")
            .to_owned()
    });
    let name = headers.get(NAME).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-name")
            .to_owned()
    });
    let impersonate = headers.get(IMPERSONATE).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-impersonate")
            .to_owned()
    });
    let skip_authz = headers.contains_key(SKIP_AUTHZ);

    let authn = tracing::info_span!(
        "authenticating request",
        identity,
        name,
        impersonate,
        skip_authz,
    )
    .in_scope(move || {
        crate::authentication::Authentication::try_new(AuthenticationParameters {
            identity,
            name,
            impersonate,
            skip: skip_authz,
        })
        .map_err(
            |AuthenticationParameters {
                 identity,
                 name,
                 impersonate,
                 skip,
             }| {
                tracing::error!(
                    identity,
                    name,
                    impersonate,
                    skip,
                    "invalid authentication parameters"
                );
                AuthorizationError::Unauthorized
            },
        )
    })?;

    tracing::info!(?authn, "authentication complete");
    Ok(tracing::info_span!("authentication", ?authn)
        .in_scope(move || {
            req.extensions_mut().insert(authn.clone());
            next.run(req).in_current_span()
        })
        .await)
}

/// Takes an authenticated request and performs a few verifications
///
/// - the origin user exists in the database, if not we create it
/// - the impersonator must be an admin
/// - the impersonated user must already exist in the database, we do not create it if it does not
/// - push the roles of the origin user in the request extensions
async fn authentication_validation_middleware(
    Extension(authn): Extension<crate::authentication::Authentication>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    use ::authz::v2::Authorizer as _;

    let openfga = regulator.openfga(); // to remove once OpenFGA is in the AppState directly
    let conn = db_pool.get().await?;

    let is_impersonation = matches!(
        authn,
        crate::authentication::Authentication::Impersonating { .. }
    );

    fn origin_user(
        user: Option<editoast_models::User>,
        identity: &str,
        header_name: &str,
    ) -> Option<(editoast_models::User, ::authz::v2::Protected<Vec<Role>>)> {
        user.inspect(|user| {
            if user.name != header_name {
                tracing::warn!(
                    identity,
                    header = header_name,
                    stored = user.name,
                    "provided name for identity differ from stored",
                );
            }
        })
        .map(|user| {
            let authz_user = ::authz::Subject::user(user.id);
            (user, ::authz::v2::subject_roles(authz_user))
        })
    }

    async fn register_origin_user(
        conn: database::DbConnection,
        (identity, name): (&str, &str),
    ) -> Result<(
        Option<editoast_models::User>,
        ::authz::v2::Protected<Vec<Role>>,
    )> {
        tracing::info!(identity, name, "registering new user");
        let user =
            editoast_models::User::register(conn, vec![identity.to_owned()], name.to_owned())
                .await?;
        let authz_user = ::authz::Subject::user(user.id);
        Ok((Some(user), ::authz::v2::subject_roles(authz_user)))
    }

    let (user, roles_prot) = conn
        .transaction(async move |conn| {
            let origin = match &authn {
                crate::authentication::Authentication::Authenticated { identity, name } => {
                    let user =
                        editoast_models::User::retrieve_by_identity(identity, conn.clone()).await?;
                    origin_user(user, identity, name)
                }
                crate::authentication::Authentication::Impersonating {
                    impersonator_identity,
                    impersonator_name,
                    impersonated_identity,
                } => {
                    let (impersonator, impersonated) = tokio::try_join!(
                        // The batching API is annoying, that's the best I can do concisely for now. We should
                        // work on the DB user management that got worse since we added multiple identities support.
                        editoast_models::User::retrieve_by_identity(
                            impersonator_identity,
                            conn.clone()
                        ),
                        editoast_models::User::retrieve_by_identity(
                            impersonated_identity,
                            conn.clone()
                        )
                    )?;
                    if impersonated.is_none() {
                        return Err::<_, crate::error::InternalError>(
                            AuthorizationError::ImpersonatedUserNotFound {
                                identity: impersonated_identity.to_owned(),
                            }
                            .into(),
                        );
                    }
                    origin_user(impersonator, impersonator_identity, impersonator_name)
                }
                crate::authentication::Authentication::Unauthenticated
                | crate::authentication::Authentication::Skip { .. } => None,
            };

            Ok(match origin {
                // origin user does exist, we use the Protected afterwards
                Some((user, roles_prot)) => (Some(user), roles_prot),
                // origin user does not exist
                None => {
                    // if there is an origin user (no skip or unauthenticated)
                    if let Some(origin) = authn.origin() {
                        register_origin_user(conn, origin).await?
                    } else {
                        (None, ::authz::v2::Protected::default())
                    }
                }
            })
        })
        .await?;

    // Drop the connection to avoid keeping it open while calling next middlewares
    // and the resuest handler itself. Keeping it open would cause deadlocks under
    // heavy load as all connection would be held by this function and handlers will
    // fail to acquire one from the pool.
    std::mem::drop(conn);

    // A failed OpenFGA request does not invalidate the creation of a new user
    let bypass = special_authorizers::Authorize(openfga);
    let Ok::<_, Infallible>(access) = bypass.authorize(roles_prot).await;
    let Ok::<_, Infallible>(roles) = access.access().await.map_err(AuthorizationError::from)?;

    if is_impersonation {
        if !roles.contains(&Role::Admin) {
            return Err(AuthorizationError::ForbiddenImpersonation.into());
        } else {
            tracing::info!("impersonation enabled");
        }
    }

    let user_id = user.as_ref().map(|editoast_models::User { id, .. }| *id);
    Ok(tracing::info_span!(
        "authentication validation",
        user_id,
        ?roles,
        is_admin = roles.contains(&Role::Admin) // easy way to filter real user requests in logs
    )
    .in_scope(move || {
        req.extensions_mut().insert(roles);
        // for `fga` queries and `authz` interface
        req.extensions_mut().insert(user_id.map(::authz::User));
        // database model, also carries the user name
        req.extensions_mut().insert(user);
        next.run(req).in_current_span()
    })
    .await)
}

/// Represents the bundle of information about the issuer of a request
/// that can be extracted form recognized headers.
#[derive(Debug, Clone)]
#[allow(clippy::large_enum_variant)]
// TODO wrap the OpenFGA client contained of the `Authenticated` variant in an Arc
//      and remove the clippy ignore.
pub enum Authentication {
    /// The issuer of the request did not provide any authentication information.
    Unauthenticated,
    /// The issuer of the request provided the 'x-remote-user-identity' header.
    Authenticated(Authorizer<PgAuthDriver>),
    /// The requests comes from a trusted service (like core). All requests are considered safe.
    SkipAuthorization {
        #[expect(unused)]
        identity: Option<String>,
        name: Option<String>,
    },
}

impl Authentication {
    fn user_id(&self) -> Result<Option<i64>, AuthorizationError> {
        match self {
            Authentication::SkipAuthorization { .. } => Ok(None),
            Authentication::Unauthenticated => Err(AuthorizationError::Unauthorized),
            Authentication::Authenticated(authorizer) => Ok(Some(authorizer.user_id())),
        }
    }

    fn user_name(&self) -> Result<Option<String>, AuthorizationError> {
        match self {
            Authentication::SkipAuthorization { name, .. } => Ok(name.clone()),
            Authentication::Unauthenticated => Err(AuthorizationError::Unauthorized),
            Authentication::Authenticated(authorizer) => {
                Ok(Some(authorizer.user_name().to_owned()))
            }
        }
    }

    async fn user_roles(&self) -> Result<HashSet<Role>, AuthorizationError> {
        match self {
            Authentication::SkipAuthorization { .. } => Ok(HashSet::from([Role::Admin])),
            Authentication::Unauthenticated => Err(AuthorizationError::Unauthorized),
            Authentication::Authenticated(authorizer) => authorizer
                .user_roles()
                .await
                .map_err(AuthorizationError::from),
        }
    }

    /// Checks if the issuer of the request has at least one of the required roles.
    /// Always returns `false` if the request is unauthenticated.
    async fn check_roles(&self, required_roles: HashSet<Role>) -> Result<bool, AuthorizerError> {
        match self {
            Authentication::SkipAuthorization { .. } => Ok(true),
            Authentication::Unauthenticated => Ok(false),
            Authentication::Authenticated(authorizer) => {
                authorizer.check_roles(required_roles).await
            }
        }
    }

    /// Function wrapper that allows you to check if the issuer of the request has the good privilege, grant, role....
    /// If the request is unauthenticated, it will return an Unauthorized error, and for the SkipAuthorization.
    /// The provided function will be called with the authorizer and its result will be checked by the allowed() method.
    /// In case of error, a Forbidden error will be returned.
    /// How to use it: `auth.check_authorization(async |authorizer| authorizer.authorize_infra_delete(infra_id).await).await?;`
    async fn check_authorization<E: Into<AuthorizationError>>(
        self,
        f: impl AsyncFnOnce(Authorizer<PgAuthDriver>) -> Result<Authorization<()>, E>,
    ) -> Result<(), AuthorizationError> {
        match self {
            Authentication::SkipAuthorization { .. } => Ok(()),
            Authentication::Unauthenticated => Err(AuthorizationError::Unauthorized),
            Authentication::Authenticated(authorizer) => f(authorizer)
                .await
                .map_err(Into::into)?
                .allowed()
                .map_err(|_| AuthorizationError::Forbidden),
        }
    }

    /// Returns the list of infra IDs that the issuer of the request is authorized to read.
    /// If user has full access (in case of admin or skip authorization), it return a Bypassed with an empty list
    async fn list_authorized_infra(&self) -> Result<Authorization<Vec<Infra>>, AuthorizerError> {
        match self {
            Authentication::SkipAuthorization { .. } => Ok(Authorization::Bypassed),
            Authentication::Unauthenticated => Ok(Authorization::Denied {
                reason: "user is not authenticated",
            }),
            Authentication::Authenticated(authorizer) => authorizer.list_authorized_infra().await,
        }
    }

    /// Returns the underlying authorizer if the request is authenticated, otherwise returns an
    /// error. If the request comes from Core, this returns false as well as it makes no sense to
    /// have an Authorizer without an authenticated user.
    fn authorizer(self) -> Result<Authorizer<PgAuthDriver>, AuthorizationError> {
        match self {
            Authentication::Authenticated(authorizer) => Ok(authorizer),
            Authentication::Unauthenticated | Authentication::SkipAuthorization { .. } => {
                Err(AuthorizationError::Unauthorized)
            }
        }
    }
}

pub type AuthenticationExt = axum::extract::Extension<Authentication>;

async fn authenticate(
    enable_authorization: bool,
    headers: &axum::http::HeaderMap,
    regulator: Regulator,
) -> Result<Authentication, AuthorizationError> {
    const IDENTITY: &str = "x-remote-user-identity";
    const NAME: &str = "x-remote-user-name";
    const SKIP_AUTHZ: &str = "x-osrd-skip-authz";
    const IMPERSONATE: &str = "x-impersonate";

    let identity = headers.get(IDENTITY).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-identity")
            .to_owned()
    });
    let name = headers.get(NAME).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-name")
            .to_owned()
    });
    let impersonate = headers.get(IMPERSONATE).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-impersonate")
            .to_owned()
    });
    let skip_authz = headers.contains_key(SKIP_AUTHZ);

    let (user, identity) = match (identity, name) {
        (identity, name) if !enable_authorization => {
            tracing::debug!(
                identity,
                name,
                "authorization disabled — all role and permission checks are bypassed"
            );
            return Ok(Authentication::SkipAuthorization { identity, name });
        }
        (identity, name) if skip_authz => {
            tracing::debug!(identity, name, "authorization skipped by request");
            return Ok(Authentication::SkipAuthorization { identity, name });
        }
        (None, _) => return Ok(Authentication::Unauthenticated),
        (Some(identity), name) => (
            UserInfo {
                identities: vec![identity.clone()],
                name: name.unwrap_or_default(),
            },
            identity,
        ),
    };

    let authorizer = match Authorizer::try_initialize(identity.clone(), regulator.clone()).await {
        Ok(authorizer) => authorizer,
        Err(AuthorizerError::UnknownUser { .. }) => {
            // The user is not in the database, let's add it
            regulator
                .clone()
                .driver()
                .ensure_user(&user.name, &user.identities[0])
                .await
                .map_err(AuthorizerError::Storage)?;
            Authorizer::try_initialize(identity, regulator.clone()).await?
        }
        Err(err) => return Err(err.into()),
    };

    let Some(impersonated_identity) = impersonate else {
        return Ok(Authentication::Authenticated(authorizer));
    };

    // The user is trying to impersonate another user
    if !authorizer.check_roles([Role::Admin].into()).await? {
        return Err(AuthorizationError::ForbiddenImpersonation);
    }

    let impersonated_authorizer =
        match Authorizer::try_initialize(impersonated_identity.clone(), regulator).await {
            Ok(authorizer) => authorizer,
            Err(AuthorizerError::UnknownUser { .. }) => {
                return Err(AuthorizationError::ImpersonatedUserNotFound {
                    identity: impersonated_identity,
                });
            }
            err => err?,
        };
    Ok(Authentication::Authenticated(impersonated_authorizer))
}

async fn authentication_middleware(
    State(AppState {
        regulator, config, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let headers = req.headers();
    let authorizer = authenticate(config.enable_authorization, headers, regulator).await?;
    req.extensions_mut().insert(authorizer);
    Ok(next.run(req).await)
}

pub type AuthorizerError = ::authz::Error<<PgAuthDriver as ::authz::StorageDriver>::Error>;

#[derive(Debug, Error, derive_more::From, EditoastError)]
#[editoast_error(base_id = "authz")]
pub enum AuthorizationError {
    #[error("Unauthorized — user must be authenticated")]
    #[editoast_error(status = 401)]
    Unauthorized,
    #[error("Forbidden — user has insufficient privileges")]
    #[editoast_error(status = 403)]
    Forbidden,
    #[error("Forbidden — user must be an admin to impersonate")]
    #[editoast_error(status = 403)]
    ForbiddenImpersonation,
    #[error("Not Found — impersonated user '{identity}' not found")]
    #[editoast_error(status = 403)]
    ImpersonatedUserNotFound { identity: String },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(AuthorizerError, fga::client::RequestFailure)]
    AuthError(AuthorizerError),
    #[error(transparent)]
    #[editoast_error(status = 500)]
    DbError(#[from] database::db_connection_pool::DatabasePoolError),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] database::db_connection_pool::PingError),
    #[error(transparent)]
    Valkey(anyhow::Error),
    #[error(transparent)]
    Openfga(anyhow::Error),
    #[error(transparent)]
    Core(#[from] core_client::Error),
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
async fn health(
    State(AppState {
        db_pool,
        valkey_client,
        health_check_timeout,
        core_client,
        regulator,
        ..
    }): State<AppState>,
) -> Result<&'static str> {
    timeout(
        health_check_timeout
            .to_std()
            .expect("timeout should be valid at this point"),
        check_health(db_pool, valkey_client, core_client, regulator.openfga()),
    )
    .await
    .map_err(|_| AppHealthError::Timeout)??;
    Ok("ok")
}

pub async fn check_health(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_client: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
    openfga: &fga::Client,
) -> Result<()> {
    let mut db_connection = db_pool.clone().get().await?;
    let openfga_ping = async move {
        openfga
            .is_healthy()
            .await
            .map_err(|err| {
                AppHealthError::Openfga(anyhow::anyhow!("OpenFGA health request failure: {err}"))
            })
            .and_then(|healthy| {
                if !healthy {
                    Err(AppHealthError::Openfga(anyhow::anyhow!(
                        "OpenFGA is not healthy"
                    )))
                } else {
                    Ok(())
                }
            })
    };
    let valkey_ping = async {
        use deadpool_redis::redis::AsyncCommands as _;
        let mut vkconn = valkey_client
            .get_connection()
            .await
            .map_err(anyhow::Error::from)
            .map_err(AppHealthError::Valkey)?;
        vkconn
            .ping::<()>()
            .await
            .map_err(anyhow::Error::from)
            .map_err(AppHealthError::Valkey)?;
        Ok(())
    };
    tokio::try_join!(
        ping_database(&mut db_connection).map_err(AppHealthError::Database),
        valkey_ping,
        core_client.ping().map_err(AppHealthError::Core),
        openfga_ping
    )?;
    Ok(())
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
pub(in crate::views) async fn version(
    State(AppState { config, .. }): State<AppState>,
) -> Json<Version> {
    Json(Version {
        git_describe: config.app_version.clone(),
    })
}

#[derive(Clone)]
pub struct CoreConfig {
    pub timeout: Duration,
    pub single_worker: bool,
    pub num_channels: usize,
    pub worker_pool_id: String,
}

pub struct OsrdyneConfig {
    pub mq_url: Url,
    pub core: CoreConfig,
}

#[derive(Clone)]
pub struct OpenfgaConfig {
    pub url: Url,
    pub store: String,
    pub max_checks_per_batch_check: u32,
    pub max_tuples_per_write: u64,
}

#[derive(Clone)]
pub struct PostgresConfig {
    pub database_url: Url,
    pub pool_size: usize,
}

pub struct ServerConfig {
    pub port: u16,
    pub address: String,
    pub health_check_timeout: Duration,
    pub map_layers_max_zoom: u8,
    pub enable_authorization: bool,
    pub postgres_config: PostgresConfig,
    pub osrdyne_config: OsrdyneConfig,
    pub valkey_config: cache::Config,
    pub openfga_config: OpenfgaConfig,
    pub root_url: Url,
    pub dynamic_assets_path: PathBuf,
    pub app_version: Option<String>,
    pub trains_traffic: Arc<RwLock<timetable::similar_trains::trains_traffic::TrainsTrafficPool>>,
}

pub struct Server {
    app_state: AppState,
    router: NormalizePath<Router>,
}

pub type Regulator = ::authz::Regulator<PgAuthDriver>;

/// The state of the whole Editoast service, available to all handlers
///
/// If only the database is needed, use `State<database::DbConnectionPoolV2>`.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<ServerConfig>,
    pub db_pool: Arc<DbConnectionPoolV2>,
    pub valkey_client: Arc<cache::Client>,
    pub infra_caches: Arc<DashMap<i64, InfraCache>>,
    pub map_layers: Arc<MapLayers>,
    pub speed_limit_tag_ids: Arc<SpeedLimitTagIds>,
    pub core_client: Arc<CoreClient>,
    pub health_check_timeout: Duration,
    pub regulator: Regulator,
    pub trains_traffic: Arc<RwLock<timetable::similar_trains::trains_traffic::TrainsTrafficPool>>,
}

impl FromRef<AppState> for Arc<DbConnectionPoolV2> {
    fn from_ref(input: &AppState) -> Self {
        input.db_pool.clone()
    }
}

impl FromRef<AppState> for Arc<SpeedLimitTagIds> {
    fn from_ref(input: &AppState) -> Self {
        input.speed_limit_tag_ids.clone()
    }
}

impl FromRef<AppState> for Arc<CoreClient> {
    fn from_ref(input: &AppState) -> Self {
        input.core_client.clone()
    }
}

impl AppState {
    #[tracing::instrument(skip_all, level = "info", err, name = "AppState initialization")]
    async fn init(config: ServerConfig) -> anyhow::Result<Self> {
        #[tracing::instrument(skip_all, level = "info", err, name = "PostgreSQL connection")]
        async fn connect_db(
            PostgresConfig {
                database_url,
                pool_size,
            }: PostgresConfig,
        ) -> anyhow::Result<Arc<DbConnectionPoolV2>> {
            let pool = DbConnectionPoolV2::try_initialize(database_url, pool_size).await?;
            Ok(Arc::new(pool))
        }
        let db_pool_fut =
            tokio::spawn(connect_db(config.postgres_config.clone()).in_current_span());

        #[tracing::instrument(skip_all, level = "info", err, name = "Core client connection")]
        async fn connect_core_client(
            CoreConfig {
                timeout,
                single_worker,
                num_channels,
                worker_pool_id,
            }: CoreConfig,
            mq_url: Url,
        ) -> anyhow::Result<Arc<CoreClient>> {
            let options = mq_client::Options {
                uri: mq_url,
                worker_pool_identifier: worker_pool_id,
                timeout: timeout.num_seconds() as u64,
                single_worker,
                num_channels,
            };
            let client = CoreClient::new_mq(options).await?;
            Ok(Arc::new(client))
        }
        let core_client_fut = tokio::spawn(
            connect_core_client(
                config.osrdyne_config.core.clone(),
                config.osrdyne_config.mq_url.clone(),
            )
            .in_current_span(),
        );

        #[tracing::instrument(skip_all, level = "info", err, name = "OpenFGA connection")]
        async fn connect_openfga(openfga_config: OpenfgaConfig) -> anyhow::Result<fga::Client> {
            let openfga = {
                tracing::info!(url = %openfga_config.url, "connecting to OpenFGA");
                match fga::Client::try_with_store(
                    &openfga_config.store,
                    openfga_config.as_settings(),
                )
                .await
                {
                    Err(fga::client::InitializationError::NotFound(store)) => {
                        tracing::info!(store, "store not found, creating it");
                        fga::Client::try_new_store(&store, openfga_config.as_settings()).await?
                    }
                    result => result?,
                }
            };
            tracing::info!(url = %openfga_config.url, "connected to OpenFGA");
            Ok(openfga)
        }
        let openfga_fut =
            tokio::spawn(connect_openfga(config.openfga_config.clone()).in_current_span());

        // Synchronous operations
        let infra_caches = DashMap::<i64, InfraCache>::default().into();
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());
        let valkey_client = Arc::new(cache::Client::new(
            config.valkey_config.clone(),
            config.app_version.as_deref().unwrap_or("NO_APP_VERSION"),
        ));

        let (db_pool, core_client, openfga) = tokio::try_join!(
            async { db_pool_fut.await? },
            async { core_client_fut.await? },
            async { openfga_fut.await? },
        )?;

        Ok(Self {
            regulator: Regulator::new(openfga, PgAuthDriver::new(db_pool.clone())),
            valkey_client,
            db_pool,
            infra_caches,
            core_client,
            map_layers: Arc::new(MapLayers::default()),
            speed_limit_tag_ids,
            health_check_timeout: config.health_check_timeout,
            trains_traffic: config.trains_traffic.clone(),
            config: Arc::new(config),
        })
    }
}

impl Server {
    #[tracing::instrument(skip_all, err, level = "info", name = "server initialization")]
    pub async fn new(config: ServerConfig) -> anyhow::Result<Self> {
        info!("Building server...");
        let app_state_fut = tokio::spawn(AppState::init(config).in_current_span());
        let router =
            tracing::debug_span!("router initialization").in_scope(|| service_router().router);
        let app_state = app_state_fut.await??;

        // Custom Bytes and String extractor configuration
        let request_payload_limit = RequestBodyLimitLayer::new(250 * 1024 * 1024); // 250MiB

        // Build CORS layer
        let cors = {
            let allowed_origin = env::var("OSRD_ALLOWED_ORIGIN").ok();
            match allowed_origin {
                Some(origin) => CorsLayer::new()
                    .allow_methods(Any)
                    .allow_headers(Any)
                    .allow_origin(
                        origin
                            .parse::<axum::http::header::HeaderValue>()
                            .expect("invalid allowed origin"),
                    ),
                None => CorsLayer::new()
                    .allow_methods(Any)
                    .allow_headers(Any)
                    .allow_origin(Any),
            }
        };

        // Configure the axum router
        let router: Router<()> = axum::Router::<AppState>::new()
            .merge(router)
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                authentication_middleware,
            ))
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                authentication_validation_middleware,
            ))
            .route_layer(axum::middleware::from_fn(
                authentication_extraction_middleware,
            ))
            .layer(OtelInResponseLayer)
            .layer(OtelAxumLayer::default())
            .layer(RequestDecompressionLayer::new())
            .layer(DefaultBodyLimit::disable())
            .layer(request_payload_limit)
            .layer(cors)
            .layer(TraceLayer::new_for_http())
            .with_state(app_state.clone());
        let normalizing_router = NormalizePathLayer::trim_trailing_slash().layer(router);

        Ok(Self {
            app_state,
            router: normalizing_router,
        })
    }

    pub async fn start(self) -> std::io::Result<()> {
        let Self { app_state, router } = self;
        let ServerConfig {
            address,
            port,
            enable_authorization,
            ..
        } = app_state.config.as_ref();

        if !*enable_authorization {
            warn!("authorization disabled — all role and permission checks are bypassed");
        }

        info!("Running server...");
        let service = ServiceExt::<axum::extract::Request>::into_make_service(router);
        let listener = tokio::net::TcpListener::bind((address.as_str(), *port)).await?;
        axum::serve(listener, service).await
    }
}

impl OpenfgaConfig {
    pub fn as_settings(&self) -> fga::client::ConnectionSettings {
        fga::client::ConnectionSettings::new(
            self.url.clone(),
            Limits {
                max_checks_per_batch_check: self.max_checks_per_batch_check,
                max_tuples_per_write: self.max_tuples_per_write,
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use serde_json::json;

    use super::test_app::TestAppBuilder;
    use crate::views::timetable::simulation_empty_response;

    #[cfg(test)]
    pub fn mocked_core_pathfinding_sim_and_proj() -> MockingClient {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [{"track_section": "TA1", "begin":0, "end": 3, "direction": "START_TO_STOP"}],
                },
                "path_item_positions": [0,1,2,3],
                "length": 3,
                "status": "success"
            }))
            .finish();
        core.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_empty_response())
            .json(simulation_empty_response())
            .finish();
        core.stub("/signal_projection")
            .response(StatusCode::OK)
            .json(json!({
                "signal_updates": [[{
                    "signal_id": "SA1",
                    "signaling_system": "ERTMS",
                    "time_start": 0,
                    "time_end": 100,
                    "position_start": 0,
                    "position_end": 100,
                    "color": 0x000000,
                    "blinking": false,
                    "aspect_label": "VL",
                }]]
            }))
            .finish();
        core
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn health() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/health");
        app.fetch(request).await.assert_status(StatusCode::OK);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn version() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/version");
        let response: HashMap<String, Option<String>> = app.fetch(request).await.json_into();
        assert!(response.contains_key("git_describe"));
    }
}
