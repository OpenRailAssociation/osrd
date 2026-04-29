mod occupancy_blocks;
pub mod similar_trains;
pub mod simulation;
pub mod stdcm;
mod track_occupancy;
pub mod train_schedule;
pub mod train_schedule_exceptions;

use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use common::units::quantities::Acceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Velocity;
use core_client::AsCoreRequest;
use core_client::conflict_detection::Conflict as CoreConflict;
use core_client::conflict_detection::ConflictDetectionRequest;
use core_client::conflict_detection::ConflictRequirement;
use core_client::conflict_detection::ConflictType;
use core_client::conflict_detection::TrainRequirements;
use core_client::conflict_detection::TrainRequirementsById;
use core_client::simulation::CompleteReportTrain;
use core_client::simulation::PhysicsConsist;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use editoast_models::timetable::Timetable;
use editoast_models::timetable::TimetableWithTrains;
use itertools::Itertools;
use itertools::izip;
use schemas::rolling_stock::RollingResistance;
use schemas::rolling_stock::RollingStock;
use schemas::rolling_stock::TowedRollingStock;
use schemas::rolling_stock::{EtcsBrakeParams, LoadingGaugeType};
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use simulation::train_simulation_batch;
use thiserror::Error;
use train_schedule::TrainScheduleResponse;
use utoipa::IntoParams;
use utoipa::ToSchema;
use uuid::Uuid;

use super::infra::InfraIdQueryParam;
use super::pagination::PaginatedList;
use super::pagination::PaginationQueryParams;
use super::pagination::PaginationStats;
use super::path::pathfinding::PathfindingResult;
use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::timetable::simulation::SimulationResponseSuccess;
use editoast_models::Infra;
use editoast_models::TrainScheduleSet;
use editoast_models::train_schedule::OccurrenceId;

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    #[editoast_error(status = 500)]
    Database(editoast_models::Error),
    #[error("Failed to parse train_id '{train_id}'")]
    #[editoast_error(status = 500)]
    ParseError { train_id: String },
    #[error("{:?} train schedule set(s) could not be found", .ids)]
    #[editoast_error(status = 404)]
    TrainScheduleSetsNotFound { ids: HashSet<i64> },
}

/// Creation result for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
pub(in crate::views) struct TimetableResult {
    pub timetable_id: i64,
}

impl From<Timetable> for TimetableResult {
    fn from(timetable: Timetable) -> Self {
        Self {
            timetable_id: timetable.id,
        }
    }
}

#[derive(IntoParams, Deserialize)]
pub struct TimetableIdParam {
    /// A timetable ID
    pub id: i64,
}

/// Create a timetable
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "timetable",
    responses(
        (status = 201, description = "Timetable with train schedule ids", body = TimetableResult),
    ),
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    let timetable = Timetable::changeset().create(conn).await?;
    let response: TimetableResult = timetable.into();

    Ok((StatusCode::CREATED, Json(response)))
}

/// Delete a timetable
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "timetable",
    params(TimetableIdParam),
    responses(
        (status = 204, description = "No content"),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    Timetable::delete_static_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize, ToSchema, Debug)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct ListTrainSchedulesResponse {
    #[schema(value_type = Vec<TrainScheduleResponse>)]
    results: Vec<TrainScheduleResponse>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Return a specific timetable with its associated paced trains
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<200>),
    responses(
        (status = 200, description = "Timetable with train schedule ids", body = inline(ListTrainSchedulesResponse)),
        (status = 404, description = "Timetable not found"),
    ),
)]
pub(in crate::views) async fn get_train_schedules(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(pagination_params): Query<PaginationQueryParams<200>>,
) -> Result<Json<ListTrainSchedulesResponse>> {
    let conn = &mut db_pool.get().await?;

    let timetable_exists = Timetable::exists(conn, timetable_id).await?;
    if !timetable_exists {
        return Err(TimetableError::NotFound { timetable_id }.into());
    }

    let train_schedule_set_ids =
        Timetable::get_train_schedule_set_ids_from_timetable(timetable_id, conn).await?;

    let settings = pagination_params
        .into_selection_settings()
        .filter(move || {
            editoast_models::TrainSchedule::TRAIN_SCHEDULE_SET_ID
                .eq_any(train_schedule_set_ids.clone())
        })
        .order_by(move || editoast_models::TrainSchedule::ID.asc());

    let (paced_trains, stats) =
        editoast_models::TrainSchedule::list_paginated(conn, settings).await?;

    let results = paced_trains.into_iter().map_into().collect();

    Ok(Json(ListTrainSchedulesResponse { stats, results }))
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct ElectricalProfileSetIdQueryParam {
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct Conflict {
    /// List of trains involved in the conflict.
    #[schema(inline)]
    train_ids: Vec<OccurrenceId>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<i64>,
    /// Datetime of the start of the conflict
    pub start_time: DateTime<Utc>,
    /// Datetime of the end of the conflict
    pub end_time: DateTime<Utc>,
    /// Type of the conflict
    #[schema(inline)]
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

impl Conflict {
    /// This function processes train ids from Core Response
    ///  and maps them to either a `train_schedule_id` or a `paced_train_occurrence_id` based on the provided key mapping.
    fn from_core_response(
        conflict: CoreConflict,
        trains_map: &HashMap<Uuid, OccurrenceId>,
    ) -> Result<Self> {
        let train_ids: Vec<_> = conflict
            .train_ids
            .into_iter()
            .map(|train_uuid| {
                trains_map
                    .get(&train_uuid)
                    .expect("Unreachable case encountered while parsing train IDs")
            })
            .cloned()
            .collect();

        let work_schedule_ids = conflict
            .work_schedule_ids
            .into_iter()
            .map(|id| {
                id.parse::<i64>().map_err(|_| TimetableError::ParseError {
                    train_id: id.clone(),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Self {
            train_ids,
            work_schedule_ids,
            start_time: conflict.start_time,
            end_time: conflict.end_time,
            conflict_type: conflict.conflict_type,
            requirements: conflict.requirements,
        })
    }
}

/// Retrieve the list of conflicts of the timetable
///
/// The following trains are **excluded** from the result:
/// - trains for which the simulation fails
/// - trains for which the simulation does not respect schedule times
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "List of conflicts", body = Vec<Conflict>),
    ),
)]
pub(in crate::views) async fn conflicts(
    State(AppState {
        config,
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<Vec<Conflict>>> {
    let conn = db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || TimetableError::InfraNotFound {
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

    let trains = retrieve_trains(conn, timetable_id).await?;

    // Flatten paced trains occurrences
    let (occurrence_ids, occurrence_trains): (Vec<_>, Vec<_>) =
        trains.iter().flat_map(|pt| pt.iter_occurrences()).unzip();
    let occurrence_simulations: Vec<_> = train_simulation_batch(
        &mut db_pool.get().await?,
        valkey_client.clone(),
        core_client.clone(),
        &occurrence_trains,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .map(|(sim, _)| sim)
    .collect();

    let request_items = izip!(occurrence_ids, occurrence_trains, occurrence_simulations)
        .filter_map(|(train_id, train_schedule, simulation)| {
            let simulation::Response::Success(simulation) = simulation.as_ref() else {
                return None;
            };
            let respect_times = simulation::path_item_respect_times(
                &simulation.final_output.report_train.path_item_times,
                &train_schedule,
            )
            .into_iter()
            .all(|path_item| path_item);
            if !respect_times {
                return None;
            }
            Some((
                train_id,
                TrainRequirements {
                    start_time: train_schedule.start_time(),
                    spacing_requirements: simulation.final_output.spacing_requirements.clone(),
                    routing_requirements: simulation.final_output.routing_requirements.clone(),
                },
            ))
        });

    let (trains_ids_map, conflict_detection_request) =
        build_conflict_core_request(infra, request_items);

    // 3. Call core
    let conflict_detection_response = conflict_detection_request.fetch(&core_client).await?;
    let conflicts = conflict_detection_response.conflicts;
    let conflicts_response: Result<Vec<Conflict>> = conflicts
        .into_iter()
        .map(|response| Conflict::from_core_response(response, &trains_ids_map))
        .collect();
    Ok(Json(conflicts_response?))
}

async fn retrieve_trains(
    mut conn: DbConnection,
    timetable_id: i64,
) -> Result<Vec<editoast_models::TrainSchedule>> {
    let timetable_trains =
        TimetableWithTrains::retrieve_or_fail(conn.clone(), timetable_id, || {
            TimetableError::NotFound { timetable_id }
        })
        .await?;
    let trains = editoast_models::TrainSchedule::retrieve_batch_unchecked(
        &mut conn,
        timetable_trains.paced_train_ids,
    )
    .await?;

    Ok(trains)
}

/// Build the core conflict detection request
fn build_conflict_core_request(
    infra: Infra,
    items: impl Iterator<Item = (OccurrenceId, TrainRequirements)>,
) -> (HashMap<Uuid, OccurrenceId>, ConflictDetectionRequest) {
    let mut trains_map: HashMap<Uuid, OccurrenceId> = HashMap::new();

    let trains_requirements: HashMap<Uuid, TrainRequirements> = items
        .map(|(train_id, train_requirements)| {
            let train_id_for_core = Uuid::new_v4();
            trains_map.insert(train_id_for_core, train_id);

            (train_id_for_core, train_requirements)
        })
        .collect();

    (
        trains_map,
        ConflictDetectionRequest {
            infra: infra.id,
            expected_version: infra.version,
            trains_requirements,
            work_schedules: None,
        },
    )
}

/// Retrieve the list of requirements of the timetable (invalid trains are ignored)
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "timetable",
    params(TimetableIdParam, PaginationQueryParams<200>, InfraIdQueryParam, ElectricalProfileSetIdQueryParam),
    responses(
        (status = 200, description = "The paginated list of timetable requirements", body = inline(TrainRequirementsPage)),
    ),
)]
pub(in crate::views) async fn requirements(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Query(page_settings): Query<PaginationQueryParams<200>>,
    Query(InfraIdQueryParam { infra_id }): Query<InfraIdQueryParam>,
    Query(ElectricalProfileSetIdQueryParam {
        electrical_profile_set_id,
    }): Query<ElectricalProfileSetIdQueryParam>,
) -> Result<Json<TrainRequirementsPage>> {
    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || TimetableError::InfraNotFound {
        infra_id,
    })
    .await?;
    Timetable::exists_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;

    let train_schedule_sets_ids =
        Timetable::get_train_schedule_set_ids_from_timetable(timetable_id, conn).await?;

    // List trains and paced trains
    let (paced_trains, stats) = editoast_models::TrainSchedule::list_paginated(
        conn,
        page_settings
            .into_selection_settings()
            .filter(move || {
                editoast_models::TrainSchedule::TRAIN_SCHEDULE_SET_ID
                    .eq_any(train_schedule_sets_ids.clone())
            })
            .order_by(move || editoast_models::TrainSchedule::ID.asc()),
    )
    .await?;

    let (train_ids, trains): (Vec<_>, Vec<_>) = paced_trains
        .iter()
        .flat_map(|pt| pt.iter_occurrences())
        .unzip();

    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        &trains,
        &infra,
        electrical_profile_set_id,
        config.app_version.as_deref(),
    )
    .await?
    .into_iter()
    .map(|(sim, _)| Arc::unwrap_or_clone(sim));

    let start_times = trains.iter().map(|ts| ts.start_time());
    let train_names = trains.iter().map(|ts| ts.train_name.clone());
    let results =
        build_trains_requirements(train_ids.into_iter(), start_times, simulations, train_names)
            .collect();

    Ok(Json(TrainRequirementsPage { results, stats }))
}

fn build_trains_requirements(
    train_ids: impl Iterator<Item = OccurrenceId>,
    start_times: impl Iterator<Item = DateTime<Utc>>,
    simulations: impl Iterator<Item = simulation::Response>,
    train_names: impl Iterator<Item = String>,
) -> impl Iterator<Item = TrainRequirementsById> {
    izip!(train_ids, start_times, simulations, train_names).filter_map(
        |(train_id, start_time, sim, train_name)| {
            let CompleteReportTrain {
                spacing_requirements,
                routing_requirements,
                ..
            } = match sim {
                simulation::Response::Success(SimulationResponseSuccess {
                    final_output, ..
                }) => Some(final_output),
                _ => None,
            }?;
            Some(TrainRequirementsById {
                train_id: train_id.to_string(),
                start_time,
                spacing_requirements,
                routing_requirements,
                train_name,
            })
        },
    )
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct TrainRequirementsPage {
    #[schema(value_type = Vec<TrainRequirementsById>)]
    results: Vec<TrainRequirementsById>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[derive(Debug, Clone)]
pub struct PhysicsConsistParameters {
    pub total_mass: Option<Mass>,
    pub total_length: Option<Length>,
    pub max_speed: Option<Velocity>,
    pub speed_limit_tag: Option<String>,
    pub loading_gauge_type: Option<LoadingGaugeType>,
    pub towed_rolling_stock: Option<TowedRollingStock>,
    pub traction_engine: RollingStock,
}

impl PhysicsConsistParameters {
    pub fn from_traction_engine(traction_engine: RollingStock) -> Self {
        PhysicsConsistParameters {
            max_speed: None,
            total_length: None,
            total_mass: None,
            speed_limit_tag: None,
            loading_gauge_type: None,
            towed_rolling_stock: None,
            traction_engine,
        }
    }

    pub fn compute_length(&self) -> Length {
        let towed_rolling_stock_length = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.length)
            .unwrap_or_default();

        self.total_length
            .unwrap_or(self.traction_engine.length + towed_rolling_stock_length)
    }

    pub fn compute_max_speed(&self) -> Velocity {
        let max_speeds = [
            self.max_speed,
            self.towed_rolling_stock
                .as_ref()
                .and_then(|towed| towed.max_speed),
            Some(self.traction_engine.max_speed),
        ];
        max_speeds
            .into_iter()
            .flatten()
            .reduce(Velocity::min)
            .unwrap_or(self.traction_engine.max_speed)
    }

    pub fn compute_startup_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .startup_acceleration
                    .max(towed_rolling_stock.startup_acceleration)
            })
            .unwrap_or(self.traction_engine.startup_acceleration)
    }

    pub fn compute_comfort_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .comfort_acceleration
                    .min(towed_rolling_stock.comfort_acceleration)
            })
            .unwrap_or(self.traction_engine.comfort_acceleration)
    }

    pub fn compute_inertia_coefficient(&self) -> f64 {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let towed_mass = total_mass - self.traction_engine.mass;
            let traction_engine_inertia =
                self.traction_engine.mass * self.traction_engine.inertia_coefficient;
            let towed_inertia = towed_mass * towed_rolling_stock.inertia_coefficient;
            ((traction_engine_inertia + towed_inertia) / total_mass).into()
        } else {
            self.traction_engine.inertia_coefficient
        }
    }

    pub fn compute_mass(&self) -> Mass {
        let traction_engine_mass = self.traction_engine.mass;
        let towed_rolling_stock_mass = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.mass)
            .unwrap_or_default();
        self.total_mass
            .unwrap_or(traction_engine_mass + towed_rolling_stock_mass)
    }

    pub fn compute_rolling_resistance(&self) -> RollingResistance {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let traction_engine_rr = &self.traction_engine.rolling_resistance;
            let towed_rs_rr = &towed_rolling_stock.rolling_resistance;
            let traction_engine_mass = self.traction_engine.mass; // kg

            let towed_mass = total_mass - traction_engine_mass; // kg

            let traction_engine_solid_friction_a = traction_engine_rr.A; // N
            let traction_engine_viscosity_friction_b = traction_engine_rr.B; // N/(m/s)
            let traction_engine_aerodynamic_drag_c = traction_engine_rr.C; // N/(m/s)²

            let towed_solid_friction_a = towed_rs_rr.A * towed_mass; // N
            let towed_viscosity_friction_b = towed_rs_rr.B * towed_mass; // N/(m/s)
            let towed_aerodynamic_drag_c = towed_rs_rr.C * towed_mass; // N/(m/s)²

            let solid_friction_a = traction_engine_solid_friction_a + towed_solid_friction_a; // N
            let viscosity_friction_b =
                traction_engine_viscosity_friction_b + towed_viscosity_friction_b; // N/(m/s)
            let aerodynamic_drag_c = traction_engine_aerodynamic_drag_c + towed_aerodynamic_drag_c; // N/(m/s)²

            RollingResistance {
                rolling_resistance_type: traction_engine_rr.rolling_resistance_type.clone(),
                A: solid_friction_a,
                B: viscosity_friction_b,
                C: aerodynamic_drag_c,
            }
        } else {
            self.traction_engine.rolling_resistance.clone()
        }
    }

    pub fn compute_const_gamma(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed| Acceleration::min(towed.const_gamma, self.traction_engine.const_gamma))
            .unwrap_or_else(|| self.traction_engine.const_gamma)
    }

    pub fn compute_etcs_brake_params(&self) -> Option<&EtcsBrakeParams> {
        // TODO: handle towed rolling-stock when applying ERTMS to that case
        let etcs_brake_params = self.traction_engine.get_etcs_brake_params();
        assert!(
            etcs_brake_params.is_none() || self.towed_rolling_stock.is_none(),
            "ETCS is not handled (yet) for towed rolling-stock"
        );
        etcs_brake_params
    }
}

impl From<PhysicsConsistParameters> for PhysicsConsist {
    fn from(params: PhysicsConsistParameters) -> Self {
        let length = params.compute_length();
        let max_speed = params.compute_max_speed();
        let startup_acceleration = params.compute_startup_acceleration();
        let comfort_acceleration = params.compute_comfort_acceleration();
        let inertia_coefficient = params.compute_inertia_coefficient();
        let mass = params.compute_mass();
        let rolling_resistance = params.compute_rolling_resistance();
        let const_gamma = params.compute_const_gamma();
        let etcs_brake_params = params.compute_etcs_brake_params().cloned();

        let traction_engine = params.traction_engine;

        Self {
            effort_curves: traction_engine.effort_curves,
            base_power_class: traction_engine.base_power_class,
            length,
            mass,
            max_speed,
            startup_time: traction_engine.startup_time,
            startup_acceleration,
            comfort_acceleration,
            const_gamma,
            etcs_brake_params,
            inertia_coefficient,
            rolling_resistance,
            power_restrictions: traction_engine.power_restrictions.into_iter().collect(),
            electrical_power_startup_time: traction_engine.electrical_power_startup_time,
            raise_pantograph_time: traction_engine.raise_pantograph_time,
        }
    }
}

/// Set links between a timetable and train schedule sets
/// If a link already exists, it is ignored
/// If a link exists and is not in the new list, it is removed
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["timetable", "train_schedule_set"],
    params(TimetableIdParam),
    request_body(content = inline(TrainScheduleSetForm)),
    responses(
        (status = 204, description = "The train schedule set has been linked to the timetable"),
    ),
)]
pub(in crate::views) async fn set_links_train_schedule_sets_to_timetable(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(TrainScheduleSetForm {
        train_schedule_set_ids,
    }): Json<TrainScheduleSetForm>,
) -> Result<impl IntoResponse> {
    let mut conn = db_pool.get().await?;

    Timetable::exists_or_fail(&mut conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;

    let _: Vec<_> = TrainScheduleSet::retrieve_batch_or_fail(
        &mut conn,
        train_schedule_set_ids.clone(),
        |missing| TimetableError::TrainScheduleSetsNotFound { ids: missing },
    )
    .await?;

    // Transaction to ensure consistency of modifications
    Timetable::set_links_train_schedule_set(timetable_id, train_schedule_set_ids, &mut conn)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Retrieve the list of train schedule sets linked to a timetable
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["timetable", "train_schedule_set"],
    params(TimetableIdParam),
    responses(
        (status = 200, description = "list of train_schedule_sets linked to a timetable", body = inline(Vec<TrainScheduleSet>)),
    ),
)]
pub(in crate::views) async fn get_train_schedule_sets_from_timetable(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
) -> Result<Json<Vec<TrainScheduleSet>>> {
    Timetable::exists_or_fail(&mut db_pool.get().await?, timetable_id, || {
        TimetableError::NotFound { timetable_id }
    })
    .await?;

    let train_schedule_set_ids = Timetable::get_train_schedule_set_ids_from_timetable(
        timetable_id,
        &mut db_pool.get().await?,
    )
    .await?;

    let (train_schedule_sets, _): (Vec<_>, _) =
        TrainScheduleSet::retrieve_batch(&mut db_pool.get().await?, train_schedule_set_ids).await?;

    Ok(Json(train_schedule_sets))
}

#[cfg_attr(test, derive(Serialize))]
#[derive(IntoParams, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetForm {
    train_schedule_set_ids: HashSet<i64>,
}

#[cfg(test)]
pub(in crate::views) fn simulation_empty_response() -> core_client::simulation::Response {
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::SimulationSuccess;
    use core_client::simulation::SpeedLimitProperties;

    core_client::simulation::Response::Success(SimulationSuccess {
        base: ReportTrain {
            positions: vec![0, 500_000, 15_050_000],
            times: vec![0, 30_000, 100_000],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1, 2, 3],
        },
        provisional: ReportTrain {
            positions: vec![0, 500_000, 15_050_000],
            times: vec![0, 30_000, 100_000],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1, 2, 3],
        },
        final_output: CompleteReportTrain {
            report_train: ReportTrain {
                positions: vec![0, 500_000, 15_050_000],
                times: vec![0, 30_000, 100_000],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 1, 2, 3],
            },
            signal_critical_positions: vec![],
            zone_updates: vec![],
            spacing_requirements: vec![],
            routing_requirements: vec![],
        },
        mrsp: SpeedLimitProperties {
            boundaries: vec![],
            values: vec![],
        },
        electrical_profiles: ElectricalProfiles {
            boundaries: vec![],
            values: vec![],
        },
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use chrono::Duration;
    use chrono::NaiveDate;
    use common::units;
    use core_client::simulation::RoutingRequirement;
    use core_client::simulation::RoutingZoneRequirement;
    use core_client::simulation::SpacingRequirement;
    use pretty_assertions::assert_eq;
    use schemas::fixtures::simple_rolling_stock;
    use schemas::fixtures::towed_rolling_stock;
    use schemas::rolling_stock::RollingResistance;

    use super::*;
    use crate::error::InternalError;
    use crate::fixtures::create_timetable;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::fixtures::create_train_schedule_set;
    use crate::fixtures::simple_paced_train_base;
    use crate::views::test_app::TestAppBuilder;
    use editoast_models::train_schedule::TrainScheduleChangeset;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_timetable() {
        let app = TestAppBuilder::default_app();
        let request = app.get(&format!("/timetable/{}/train_schedules", 0));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Insert timetable
        let request = app.post("/timetable");

        let created_timetable: TimetableResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let retrieved_timetable =
            Timetable::retrieve(pool.get_ok(), created_timetable.timetable_id)
                .await
                .expect("Failed to retrieve timetable")
                .expect("Timetable not found");

        assert_eq!(created_timetable, retrieved_timetable.into());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_delete() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let timetable = create_timetable(&mut pool.get_ok()).await;

        let request = app.delete(format!("/timetable/{}", timetable.id).as_str());

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let exists = Timetable::exists(&mut pool.get_ok(), timetable.id)
            .await
            .expect("Failed to check if timetable exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_timetable_train_schedules() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut pool.get_ok()).await;

        let train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_2.train_occurrence.start_time += Duration::minutes(200);
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::seconds(30).try_into().unwrap();

        let train_schedules = vec![train_schedule_1, train_schedule_2];

        let changesets = train_schedules
            .into_iter()
            .map(TrainScheduleChangeset::from)
            .map(|cs| cs.train_schedule_set_id(train_schedule_set.id))
            .collect::<Vec<_>>();

        let _train_schedules: Vec<_> =
            editoast_models::TrainSchedule::create_batch(&mut pool.get_ok(), changesets)
                .await
                .expect("Failed to create train schedules");

        let request = app.get(format!("/timetable/{}/train_schedules", timetable.id).as_str());
        let list: ListTrainSchedulesResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(list.results.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_not_found_timetable_train_schedules() {
        let app = TestAppBuilder::default_app();
        let request = app.get(format!("/timetable/{}/train_schedules", 0).as_str());
        let response: InternalError = app
            .fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json_into();
        assert_eq!(&response.error_type, "editoast:timetable:NotFound")
    }

    // Build one train schedule and one paced train with 2 occurrences
    // then check that the function 'build_conflict_core_request'
    // produce something coherent
    #[test]
    fn build_coherent_conflict_core_request() {
        // Given
        let infra = Infra::default();
        let ts_id = 13;
        let ts_start_time = NaiveDate::from_ymd_opt(2025, 1, 1)
            .unwrap()
            .and_hms_opt(8, 0, 0)
            .unwrap()
            .and_utc();

        let spacing_requirement = SpacingRequirement {
            zone: "ZONE_1".to_string(),
            begin_time: 0,
            end_time: 7,
        };
        let routing_requirement = RoutingRequirement {
            route: "ZONE_2".to_string(),
            begin_time: 12,
            zones: vec![RoutingZoneRequirement {
                zone: "ZONE_3".to_string(),
                entry_detector: "D_1".to_string(),
                exit_detector: "D_2".to_string(),
                switches: {
                    let mut map = HashMap::new();
                    map.insert("S_1".to_string(), "S_2".to_string());
                    map
                },
                end_time: 15,
            }],
        };
        let paced_train_id = 42;
        let paced_start_time = NaiveDate::from_ymd_opt(2025, 1, 1)
            .unwrap()
            .and_hms_opt(9, 0, 0)
            .unwrap()
            .and_utc();
        let paced_interval = Duration::try_hours(1).unwrap();

        let train_ids = vec![
            OccurrenceId::new_base(paced_train_id, 0),
            OccurrenceId::new_base(paced_train_id, 1),
            OccurrenceId::new_base(ts_id, 0),
        ];

        let requirements = vec![
            TrainRequirements {
                start_time: paced_start_time,
                spacing_requirements: vec![spacing_requirement.clone()],
                routing_requirements: vec![routing_requirement.clone()],
            },
            TrainRequirements {
                start_time: paced_start_time + paced_interval,
                spacing_requirements: vec![spacing_requirement.clone()],
                routing_requirements: vec![routing_requirement.clone()],
            },
            TrainRequirements {
                start_time: ts_start_time,
                spacing_requirements: vec![spacing_requirement.clone()],
                routing_requirements: vec![routing_requirement.clone()],
            },
        ];

        // When
        let (trains_ids_map, conflict_core_request) =
            build_conflict_core_request(infra, train_ids.into_iter().zip(requirements));

        // Then (assert the train schedule)
        assert_eq!(conflict_core_request.trains_requirements.len(), 3);

        let simple_ts_train_core_id = trains_ids_map
            .iter()
            .find_map(|(core_id, train_id)| match train_id {
                OccurrenceId::Base {
                    train_schedule_id, ..
                } if *train_schedule_id == ts_id => Some(core_id),
                _ => None,
            })
            .unwrap();

        let simple_requirements = conflict_core_request
            .trains_requirements
            .get(simple_ts_train_core_id)
            .unwrap();
        assert_eq!(simple_requirements.start_time, ts_start_time);
        assert_eq!(
            simple_requirements.spacing_requirements,
            vec![spacing_requirement.clone()]
        );
        assert_eq!(
            simple_requirements.routing_requirements,
            vec![routing_requirement.clone()]
        );

        // Then (assert the paced train, first occurrence)
        let paced_0_train_core_id = trains_ids_map
            .iter()
            .find_map(|(core_id, train_id)| match train_id {
                OccurrenceId::Base {
                    train_schedule_id,
                    index,
                    ..
                } if *train_schedule_id == paced_train_id && *index == 0 => Some(core_id),
                _ => None,
            })
            .unwrap();
        let paced_0_requirements = conflict_core_request
            .trains_requirements
            .get(paced_0_train_core_id)
            .unwrap();
        assert_eq!(paced_0_requirements.start_time, paced_start_time);
        assert_eq!(
            paced_0_requirements.spacing_requirements,
            vec![spacing_requirement.clone()]
        );
        assert_eq!(
            paced_0_requirements.routing_requirements,
            vec![routing_requirement.clone()]
        );

        // Then (assert the paced train, second occurrence)
        let paced_1_train_core_id = trains_ids_map
            .iter()
            .find_map(|(core_id, train_id)| match train_id {
                OccurrenceId::Base {
                    train_schedule_id,
                    index,
                    ..
                } if *train_schedule_id == paced_train_id && *index == 1 => Some(core_id),
                _ => None,
            })
            .unwrap();
        let paced_1_requirements = conflict_core_request
            .trains_requirements
            .get(paced_1_train_core_id)
            .unwrap();
        assert_eq!(
            paced_1_requirements.start_time,
            paced_start_time + paced_interval
        );
        assert_eq!(
            paced_1_requirements.spacing_requirements,
            vec![spacing_requirement]
        );
        assert_eq!(
            paced_1_requirements.routing_requirements,
            vec![routing_requirement]
        );
    }

    fn create_physics_consist() -> PhysicsConsistParameters {
        PhysicsConsistParameters {
            total_length: Some(units::meter::new(100.0)),
            total_mass: Some(units::kilogram::new(50000.0)),
            max_speed: Some(units::meter_per_second::new(22.0)),
            speed_limit_tag: None,
            loading_gauge_type: Some(simple_rolling_stock().loading_gauge),
            towed_rolling_stock: Some(towed_rolling_stock()),
            traction_engine: simple_rolling_stock(),
        }
    }

    #[test]
    fn physics_consist_compute_length() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_length = Some(units::meter::new(100.0));
        physics_consist.traction_engine.length = units::meter::new(40.0);

        // We always take total_length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(100000.)
        );

        physics_consist.total_length = None;
        // When no total_length we take towed length + traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(70000.)
        );

        physics_consist.total_length = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified length and towed rolling stock, we take traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(40000.)
        );
    }

    #[test]
    fn physics_consist_compute_mass() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_mass = Some(units::kilogram::new(50000.0));
        physics_consist.traction_engine.mass = units::kilogram::new(15000.0);

        // We always take total_mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(50000.));

        physics_consist.total_mass = None;
        // When no total_mass we take towed mass + traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(65000.));

        physics_consist.total_mass = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified mass and towed rolling stock, we take traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(15000.));
    }

    #[test]
    fn physics_consist_max_speed() {
        // Towed max speed 35
        let mut physics_consist = create_physics_consist();
        physics_consist.max_speed = Some(units::meter_per_second::new(20.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(22.0);

        // We take the smallest max speed
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(20.0)
        );

        physics_consist.max_speed = Some(units::meter_per_second::new(25.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(24.0);

        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.max_speed = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.traction_engine.max_speed = units::meter_per_second::new(40.0);
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(35.0)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(40.0)
        );
    }

    #[test]
    fn physics_consist_compute_startup_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.06

        // We take the biggest
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.06)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.04)
        );
    }

    #[test]
    fn physics_consist_compute_comfort_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.2

        // We take the smallest
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );
    }

    #[test]
    fn physics_consist_compute_inertia_coefficient() {
        let mut physics_consist = create_physics_consist();

        approx::assert_relative_eq!(physics_consist.compute_inertia_coefficient(), 1.065);

        physics_consist.towed_rolling_stock = None;
        assert_eq!(physics_consist.compute_inertia_coefficient(), 1.10,);
    }

    #[test]
    fn physics_consist_compute_rolling_resistance() {
        let mut physics_consist = create_physics_consist();

        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            RollingResistance {
                rolling_resistance_type: "davis".to_string(),
                A: units::newton::new(35001.0),
                B: units::kilogram_per_second::new(350.01),
                C: units::kilogram_per_meter::new(7.0005),
            }
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            physics_consist.traction_engine.rolling_resistance,
        );
    }

    #[test]
    fn physics_consist_compute_gamma() {
        // Towed const gamma 0.5
        let mut physics_consist = create_physics_consist();
        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.4);

        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.4)
        );

        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.6);
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.5)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.6)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_set_links_train_schedule_sets_to_timetable() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let timetable = create_timetable(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let train_schedule_set_form = TrainScheduleSetForm {
            train_schedule_set_ids: HashSet::from([train_schedule_set_id]),
        };
        let request = app
            .post(format!("/timetable/{}/train_schedule_sets", timetable.id).as_str())
            .json(&train_schedule_set_form);
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let request = app.get(format!("/timetable/{}/train_schedule_sets", timetable.id).as_str());
        let train_schedule_sets: Vec<TrainScheduleSet> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(train_schedule_sets, vec![train_schedule_set]);
    }
}
