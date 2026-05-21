mod authz;
mod catalog_entry;
mod documents;
pub mod electrical_profiles;
pub mod fonts;
pub mod health;
pub mod icons;
pub mod infra;
mod layers;
mod level_crossing_occupancy;
pub mod operational_studies;
pub mod pagination;
pub mod params;
pub mod path;
pub mod project;
pub mod projection;
pub mod rolling_stock;
pub mod round_trips;
pub mod scenario;
pub mod search;
mod server;
pub mod sprites;
pub mod stdcm_debug;
pub mod stdcm_search_environment;
pub mod study;
pub mod sub_categories;
pub mod temporary_speed_limits;
pub mod timetable;
mod train_schedule_set;
mod version;
pub mod work_schedules;
mod worker_load;

pub use server::*;

#[cfg(test)]
mod test_app;
use ::authz::Authorization;
use ::authz::Infra;
#[cfg(test)]
use test_app::test_app;

use ::core::str;
use std::collections::HashSet;

use ::authz::Authorizer;
use ::authz::Role;

pub use server::OpenApiRoot;

use core_client::CoreClient;
use editoast_derive::EditoastError;
use thiserror::Error;

use crate::error::Result;
use editoast_models::PgAuthDriver;

fn service_router() -> server::router::DocumentedRouter {
    use server::router::delete;
    use server::router::get;
    use server::router::patch;
    use server::router::post;
    use server::router::put;

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

    server::router::DocumentedRouter::root(|path| {
        path
            //
            // random stuff
            //
            .route("/health", get!(health::health))
            .route("/version", get!(version::version))
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
            .route("/icons/{signaling_system}/{file_name}", get!(icons::icons))
            .route("/search", post!(search::search))
            .route(
                "/stdcm/debug_data/{trace_id}",
                get!(stdcm_debug::get_debug_data),
            )
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

pub use server::middlewares::AuthenticationExt;

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

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use serde_json::json;

    use crate::views::timetable::simulation_empty_response;

    #[cfg(test)]
    pub fn mocked_core_pathfinding_sim_and_proj() -> MockingClient {
        let mut core = MockingClient::new();
        let mut pathfinding_stub = core.stub("/pathfinding/blocks").response(StatusCode::OK);
        for _ in 0..10 {
            pathfinding_stub = pathfinding_stub.json(
                 json!({
                    "path": {
                        "blocks":[],
                        "routes": [],
                        "track_section_ranges": [{"track_section": "TA1", "begin":0, "end": 3, "direction": "START_TO_STOP"}],
                    },
                    "path_item_positions": [0,1,2,3],
                    "length": 3,
                    "status": "success"
            }));
        }
        pathfinding_stub.finish();
        let mut simulation_stub = core.stub("/standalone_simulation").response(StatusCode::OK);
        for _ in 0..10 {
            simulation_stub = simulation_stub.json(simulation_empty_response());
        }
        simulation_stub.finish();
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
}
