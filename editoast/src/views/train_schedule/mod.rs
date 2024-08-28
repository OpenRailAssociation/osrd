pub mod projection;
pub mod simulation_report;

use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::DerefMut;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::scoped_futures::ScopedFutureExt;
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockComfortType;
use editoast_schemas::train_schedule::Allowance;
use editoast_schemas::train_schedule::RjsPowerRestrictionRange;
use itertools::izip;
use serde::Deserialize;
use serde::Serialize;
use simulation_report::SimulationReport;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use self::projection::Projection;
use super::electrical_profiles::ElectricalProfilesError;
use crate::core::simulation::CoreTrainSchedule;
use crate::core::simulation::SimulationRequest;
use crate::core::simulation::SimulationResponse;
use crate::core::simulation::TrainStop;
use crate::core::AsCoreRequest;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::filter_invalid_trains;
use crate::models::train_schedule::ScheduledPoint;
use crate::models::train_schedule::TrainScheduleOptions;
use crate::models::Create;
use crate::models::Delete;
use crate::models::Pathfinding;
use crate::models::Retrieve;
use crate::models::Scenario;
use crate::models::SimulationOutputChangeset;
use crate::models::Timetable;
use crate::models::TrainSchedule;
use crate::models::TrainScheduleChangeset;
use crate::models::Update;
use crate::modelsv2::ElectricalProfileSet;
use crate::modelsv2::Infra;
use crate::modelsv2::LightRollingStockModel;
use crate::modelsv2::Retrieve as RetrieveV2;
use crate::modelsv2::RetrieveBatch;
use crate::modelsv2::RollingStockModel;
use crate::tables;
use crate::views::infra::InfraApiError;
use crate::views::train_schedule::simulation_report::fetch_simulation_output;
use crate::AppState;
use crate::DieselJson;
use editoast_models::DbConnectionPool;

crate::routes! {
    "/train_schedule" => {
        "/results" => get_results,
        "/standalone_simulation" => standalone_simulation,
        delete_multiple,
        patch_multiple,
        "/{id}" => {
            delete,
            "/result" => get_result,
            get,
        },
    },
}

editoast_common::schemas! {
    TrainScheduleBatchItem,
    TrainSchedulePatch,
    TrainSimulationResponse,
    simulation_report::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule")]
pub enum TrainScheduleError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 400)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 400)]
    NotFound { train_schedule_id: i64 },
    #[error("Rolling Stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 400)]
    RollingStockNotFound { rolling_stock_id: i64 },
    #[error("Path '{path_id}', could not be found")]
    #[editoast_error(status = 400)]
    PathNotFound { path_id: i64 },
    #[error("Train Schedule '{train_schedule_id}' is not simulated")]
    #[editoast_error(status = 500)]
    UnsimulatedTrainSchedule { train_schedule_id: i64 },
    #[error("No train schedules given")]
    #[editoast_error(status = 400)]
    NoTrainSchedules,
    #[error("Batch should have the same timetable")]
    #[editoast_error(status = 400)]
    BatchShouldHaveSameTimetable,
    #[error("No simulation given")]
    #[editoast_error(status = 500)]
    NoSimulation,
    #[error("Some Train Schedules could not be found")]
    #[editoast_error(status = 400)]
    BatchTrainScheduleNotFound,
}

#[derive(IntoParams)]
#[allow(unused)]
struct TrainScheduleIdParam {
    /// A train schedule ID
    id: i64,
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainSchedule)
    )
)]
async fn get(
    app_state: State<AppState>,
    Path(train_schedule_id): Path<i64>,
) -> Result<Json<TrainSchedule>> {
    let db_pool = app_state.db_pool_v1.clone();

    // Return the timetable
    let train_schedule = match TrainSchedule::retrieve(db_pool, train_schedule_id).await? {
        Some(train_schedule) => train_schedule,
        None => return Err(TrainScheduleError::NotFound { train_schedule_id }.into()),
    };
    Ok(Json(train_schedule))
}

/// Delete a train schedule and its result
#[utoipa::path(
    delete, path = "",
    tag = "train_schedule,timetable",
    params(TrainScheduleIdParam),
    responses(
        (status = 204, description = "The train schedule has been deleted")
    )
)]
async fn delete(
    app_state: State<AppState>,
    Path(train_schedule_id): Path<i64>,
) -> Result<impl IntoResponse> {
    let db_pool = app_state.db_pool_v1.clone();
    if !TrainSchedule::delete(db_pool, train_schedule_id).await? {
        return Err(TrainScheduleError::NotFound { train_schedule_id }.into());
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize, ToSchema)]
struct BatchDeletionRequest {
    ids: Vec<i64>,
}

/// Delete multiple train schedules at once
#[utoipa::path(
    delete, path = "",
    tag = "train_schedule,timetable",
    request_body = inline(BatchDeletionRequest),
    responses(
        (status = 204, description = "The train schedules have been deleted")
    ),
)]
async fn delete_multiple(
    db_pool: State<DbConnectionPoolV2>,
    Json(request): Json<BatchDeletionRequest>,
) -> Result<impl IntoResponse> {
    use crate::tables::train_schedule::dsl::*;

    let train_schedule_ids = request.ids;
    diesel::delete(train_schedule.filter(id.eq_any(train_schedule_ids)))
        .execute(&mut db_pool.get().await?)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// A patch of a train schedule
#[derive(Debug, Default, Clone, Deserialize, ToSchema)]
struct TrainSchedulePatch {
    id: i64,
    train_name: Option<String>,
    labels: Option<Vec<String>>,
    departure_time: Option<f64>,
    initial_speed: Option<f64>,
    allowances: Option<Vec<Allowance>>,
    scheduled_points: Option<Vec<ScheduledPoint>>,
    comfort: Option<RollingStockComfortType>,
    speed_limit_tags: Option<String>,
    power_restriction_ranges: Option<Vec<RjsPowerRestrictionRange>>,
    options: Option<TrainScheduleOptions>,
    path_id: Option<i64>,
    rolling_stock_id: Option<i64>,
}

impl From<TrainSchedulePatch> for TrainScheduleChangeset {
    fn from(value: TrainSchedulePatch) -> Self {
        Self {
            id: Some(value.id),
            train_name: value.train_name,
            labels: value.labels.map(DieselJson),
            departure_time: value.departure_time,
            initial_speed: value.initial_speed,
            allowances: value.allowances.map(DieselJson),
            scheduled_points: value.scheduled_points.map(DieselJson),
            comfort: value.comfort.map(|c| c.to_string()),
            speed_limit_tags: Some(value.speed_limit_tags),
            power_restriction_ranges: Some(value.power_restriction_ranges.map(DieselJson)),
            options: Some(value.options.map(DieselJson)),
            path_id: value.path_id,
            rolling_stock_id: value.rolling_stock_id,
            ..Default::default()
        }
    }
}

#[derive(ToSchema, Deserialize)]
#[serde(transparent)]
struct PatchMultiplePayload(#[schema(min_items = 1)] Vec<TrainSchedulePatch>);

/// Update multiple train schedules at once and re-run simulations accordingly
#[utoipa::path(
    patch, path = "",
    tag = "train_schedule,timetable",
    request_body = inline(PatchMultiplePayload),
    responses(
        (status = 204, description = "The train schedules have been updated")
    )
)]
async fn patch_multiple(
    app_state: State<AppState>,
    Json(train_schedules_changesets): Json<PatchMultiplePayload>,
) -> Result<impl IntoResponse> {
    let db_pool = app_state.db_pool_v1.clone();
    let core = app_state.core_client.clone();

    let train_schedules_changesets = train_schedules_changesets.0;
    if train_schedules_changesets.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }

    let mut conn = db_pool.get().await?;
    conn.transaction::<_, InternalError, _>(|conn| {
        async {
            let mut train_schedules = Vec::new();
            for train_patch in train_schedules_changesets {
                let id = train_patch.id;
                let rs_id = train_patch.rolling_stock_id;
                let mut changeset = TrainScheduleChangeset::from(train_patch);

                // Update the rolling stock version if needed
                if let Some(rs_id) = rs_id {
                    changeset.rollingstock_version = Some(
                        LightRollingStockModel::retrieve(conn, rs_id)
                            .await?
                            .unwrap()
                            .version,
                    );
                };
                let train_schedule: TrainSchedule = match changeset.update_conn(conn, id).await? {
                    Some(ts) => ts,
                    None => {
                        return Err(TrainScheduleError::NotFound {
                            train_schedule_id: id,
                        }
                        .into())
                    }
                }
                .into();

                train_schedules.push(train_schedule);
            }

            // Delete the associated simulation output
            {
                use crate::tables::simulation_output::dsl::*;
                let train_schedule_ids = train_schedules
                    .iter()
                    .map(|ts| ts.id.unwrap())
                    .collect::<Vec<_>>();
                diesel::delete(
                    simulation_output.filter(train_schedule_id.eq_any(train_schedule_ids)),
                )
                .execute(conn)
                .await?;
            }

            // Resimulate the trains
            let id_timetable = train_schedules[0].timetable_id;
            if train_schedules
                .iter()
                .any(|ts| ts.timetable_id != id_timetable)
            {
                return Err(TrainScheduleError::BatchShouldHaveSameTimetable.into());
            }

            let timetable = Timetable::retrieve_conn(conn, id_timetable).await?.ok_or(
                TrainScheduleError::TimetableNotFound {
                    timetable_id: id_timetable,
                },
            )?;

            let scenario = timetable.get_scenario(db_pool.clone()).await?;

            // Batch by path
            let mut path_to_train_schedules: HashMap<_, Vec<_>> = HashMap::new();
            for train_schedule in train_schedules {
                let path_id = train_schedule.path_id;
                let train_schedules = path_to_train_schedules.entry(path_id).or_default();
                train_schedules.push(train_schedule);
            }

            for train_schedules in path_to_train_schedules.values() {
                let request_payload =
                    create_backend_request_payload(train_schedules, &scenario, db_pool.clone())
                        .await?;
                let response_payload = request_payload.fetch(core.as_ref()).await?;
                let simulation_outputs = process_simulation_response(response_payload)?;

                for (i, mut simulation_output) in simulation_outputs.into_iter().enumerate() {
                    let train_schedule_id = train_schedules[i].id.unwrap();
                    simulation_output.train_schedule_id = Some(Some(train_schedule_id));
                    simulation_output.create_conn(conn).await?;
                }
            }
            Ok(())
        }
        .scope_boxed()
    })
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct GetResultQuery {
    path_id: Option<i64>,
}

/// Retrieve a simulation result
#[utoipa::path(
    get, path = "",
    tag = "train_schedule",
    params(GetResultQuery, TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule result", body = SimulationReport)
    )
)]
async fn get_result(
    app_state: State<AppState>,
    Path(id): Path<i64>,
    Query(query): Query<GetResultQuery>,
) -> Result<Json<SimulationReport>> {
    let db_pool = app_state.db_pool_v2.clone();
    let core = app_state.core_client.clone();
    let train_schedule_id = id;

    let train_schedule =
        match TrainSchedule::retrieve_conn(db_pool.get().await?.deref_mut(), train_schedule_id)
            .await?
        {
            Some(train_schedule) => train_schedule,
            None => return Err(TrainScheduleError::NotFound { train_schedule_id }.into()),
        };

    let projection_path_id = query.path_id.unwrap_or(train_schedule.path_id);

    let projection_path =
        match Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), projection_path_id)
            .await?
        {
            Some(path) => path,
            None => {
                return Err(TrainScheduleError::PathNotFound {
                    path_id: projection_path_id,
                }
                .into())
            }
        };

    let projection_path_payload = projection_path.payload.0;

    let projection = Projection::new(&projection_path_payload);

    let id_timetable = train_schedule.timetable_id;

    let timetable = Timetable::retrieve_conn(db_pool.get().await?.deref_mut(), id_timetable)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: id_timetable,
        })?;

    let scenario = timetable
        .get_scenario_conn(db_pool.get().await?.deref_mut())
        .await?;

    let infra = scenario.infra_id.expect("Scenario should have an infra id");

    let simulation_output = fetch_simulation_output(&train_schedule, db_pool.clone()).await?;
    let simulation_output_cs = SimulationOutputChangeset::from(simulation_output);
    let res = simulation_report::create_simulation_report(
        infra,
        train_schedule,
        &projection,
        &projection_path_payload,
        simulation_output_cs,
        db_pool.clone(),
        core.as_ref(),
    )
    .await?;
    Ok(Json(res))
}

#[derive(Debug, Deserialize, ToSchema, Serialize)]
struct TrainsSimulationRequest {
    /// A path ID to project the simulation results onto. If not provided, the path of the first train will be used.
    path_id: Option<i64>,
    /// The IDs of the trains to simulate
    train_ids: Vec<i64>,
}

#[derive(Debug, Deserialize, ToSchema, Serialize)]
struct TrainSimulationResponse {
    /// The simulation results
    simulations: Vec<SimulationReport>,
    /// Requested trains that are invalid and thus not simulated
    invalid_trains: Vec<i64>,
}

/// Retrieve the simulation result of multiple train schedules
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(TrainsSimulationRequest),
    responses(
        (status = 200, description = "The train schedule simulations results and a list of invalid train_ids", body = TrainSimulationResponse)
    )
)]
async fn get_results(
    app_state: State<AppState>,
    Json(request): Json<TrainsSimulationRequest>,
) -> Result<Json<TrainSimulationResponse>> {
    let db_pool = app_state.db_pool_v2.clone();
    let core = app_state.core_client.clone();

    use tables::train_schedule::dsl;
    let train_ids = request.train_ids.clone();

    if train_ids.is_empty() {
        return Ok(Json(TrainSimulationResponse {
            simulations: vec![],
            invalid_trains: vec![],
        }));
    }

    // TODO: replace by ModelV2::batch_retrieve when ready
    let schedules = dsl::train_schedule
        .filter(dsl::id.eq_any(train_ids.clone()))
        .load::<TrainSchedule>(db_pool.get().await?.deref_mut())
        .await?;

    if schedules.len() != train_ids.len() {
        return Err(TrainScheduleError::BatchTrainScheduleNotFound.into());
    }

    let timetable_id = schedules[0].timetable_id;
    if schedules.iter().any(|ts| ts.timetable_id != timetable_id) {
        return Err(TrainScheduleError::BatchShouldHaveSameTimetable.into());
    }

    let timetable = Timetable::retrieve_conn(db_pool.get().await?.deref_mut(), timetable_id)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound { timetable_id })?;
    let infra_version = timetable
        .infra_version_from_timetable(db_pool.get().await?.deref_mut())
        .await;
    let (result_schedules, invalid_trains) =
        filter_invalid_trains(db_pool.get().await?.deref_mut(), schedules, infra_version).await?;
    if result_schedules.is_empty() {
        return Ok(Json(TrainSimulationResponse {
            simulations: vec![],
            invalid_trains,
        }));
    }

    let path_id = request
        .path_id
        .unwrap_or_else(|| result_schedules[0].path_id);

    let projection_path = Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), path_id)
        .await?
        .ok_or(TrainScheduleError::PathNotFound { path_id })?;

    let projection_path_payload = (*projection_path.payload).clone();

    let projection = Projection::new(&projection_path_payload);

    let scenario = timetable
        .get_scenario_conn(db_pool.get().await?.deref_mut())
        .await?;

    let infra = scenario.infra_id.expect("Scenario should have an infra id");
    let mut res = Vec::new();
    for schedule in result_schedules {
        let simulation_output = fetch_simulation_output(&schedule, db_pool.clone()).await?;
        let simulation_output_content = SimulationOutputChangeset::from(simulation_output);
        let sim_report = simulation_report::create_simulation_report(
            infra,
            schedule.clone(),
            &projection,
            &projection_path_payload,
            simulation_output_content,
            db_pool.clone(),
            core.as_ref(),
        )
        .await?;
        res.push(sim_report);
    }
    Ok(Json(TrainSimulationResponse {
        simulations: res,
        invalid_trains,
    }))
}

/// The list of train schedules to simulate
#[derive(Debug, Deserialize, ToSchema)]
struct TrainScheduleBatch {
    timetable: i64,
    path: i64,
    #[schema(min_items = 1)]
    schedules: Vec<TrainScheduleBatchItem>,
}

#[derive(Debug, Deserialize, ToSchema)]
struct TrainScheduleBatchItem {
    train_name: String,
    #[serde(default)]
    labels: Vec<String>,
    departure_time: f64,
    initial_speed: f64,
    #[serde(default)]
    allowances: Vec<Allowance>,
    #[serde(default)]
    scheduled_points: Vec<ScheduledPoint>,
    #[serde(default)]
    comfort: RollingStockComfortType,
    speed_limit_tags: Option<String>,
    power_restriction_ranges: Option<Vec<RjsPowerRestrictionRange>>,
    options: Option<TrainScheduleOptions>,
    rolling_stock_id: i64,
    // Filled later by the endpoint
    #[serde(skip)]
    infra_version: String,
    // Filled later by the endpoint
    #[serde(skip)]
    rollingstock_version: i64,
}

impl From<TrainScheduleBatch> for Vec<TrainSchedule> {
    fn from(batch: TrainScheduleBatch) -> Self {
        let mut res = Vec::new();
        for item in batch.schedules {
            res.push(TrainSchedule {
                id: None,
                timetable_id: batch.timetable,
                path_id: batch.path,
                train_name: item.train_name,
                labels: DieselJson(item.labels),
                departure_time: item.departure_time,
                initial_speed: item.initial_speed,
                allowances: DieselJson(item.allowances),
                scheduled_points: DieselJson(item.scheduled_points),
                comfort: item.comfort.to_string(),
                speed_limit_tags: item.speed_limit_tags,
                power_restriction_ranges: item.power_restriction_ranges.map(DieselJson),
                options: item.options.map(DieselJson),
                rolling_stock_id: item.rolling_stock_id,
                infra_version: Some(item.infra_version),
                rollingstock_version: Some(item.rollingstock_version),
            });
        }
        res
    }
}

/// Create a batch of train schedule and run simulations accordingly
#[utoipa::path(
    post, path = "",
    tag = "train_schedule",
    request_body = inline(TrainScheduleBatch),
    responses(
        (status = 200, description = "The ids of the train_schedules created", body = Vec<i64>)
    )
)]
async fn standalone_simulation(
    app_state: State<AppState>,
    Json(request): Json<TrainScheduleBatch>,
) -> Result<Json<Vec<i64>>> {
    let db_pool = app_state.db_pool_v1.clone();
    let core = app_state.core_client.clone();

    let id_timetable = request.timetable;

    let train_schedules: Vec<TrainSchedule> = request.into();

    if train_schedules.is_empty() {
        return Err(TrainScheduleError::NoTrainSchedules.into());
    }

    let timetable = Timetable::retrieve(db_pool.clone(), id_timetable)
        .await?
        .ok_or(TrainScheduleError::TimetableNotFound {
            timetable_id: id_timetable,
        })?;

    let scenario = timetable.get_scenario(db_pool.clone()).await?;

    let infra_id = scenario.infra_id.unwrap();
    let mut conn = db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(&mut conn, infra_id, || InfraApiError::NotFound { infra_id })
            .await?;

    let request_payload =
        create_backend_request_payload(&train_schedules, &scenario, db_pool.clone()).await?;
    let response_payload = request_payload.fetch(&core).await?;
    let simulation_outputs = process_simulation_response(response_payload)?;

    assert_eq!(train_schedules.len(), simulation_outputs.len());

    // Start a transaction
    let res_ids = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                let mut res_ids = Vec::new();
                // Save inputs
                for mut train_schedule in train_schedules {
                    train_schedule.infra_version = Some(infra.version.clone());
                    train_schedule.rollingstock_version = Some(
                        LightRollingStockModel::retrieve(conn, train_schedule.rolling_stock_id)
                            .await?
                            .unwrap()
                            .version,
                    );
                    let id = train_schedule
                        .create_conn(conn)
                        .await?
                        .id
                        .expect("Train schedule should have an id");
                    res_ids.push(id);
                }
                // Save outputs
                for (i, mut simulation_output) in simulation_outputs.into_iter().enumerate() {
                    simulation_output.train_schedule_id = Some(Some(res_ids[i]));
                    simulation_output.create_conn(conn).await?;
                }
                Ok(res_ids)
            }
            .scope_boxed()
        })
        .await?;
    Ok(Json(res_ids))
}

async fn create_backend_request_payload(
    train_schedules: &[TrainSchedule],
    scenario: &Scenario,
    db_pool: Arc<DbConnectionPool>,
) -> Result<SimulationRequest> {
    let mut db_conn = db_pool.get().await?;

    let infra = scenario.infra_id.expect("Scenario should have an infra");
    let rolling_stocks_ids = train_schedules
        .iter()
        .map(|ts| ts.rolling_stock_id)
        .collect::<HashSet<_>>();
    let mut rolling_stocks: Vec<RollingStock> = Vec::new();
    let mut rolling_id_to_name = HashMap::new();

    let rolling_stock_batch: Vec<RollingStockModel> =
        RollingStockModel::retrieve_batch_or_fail(&mut db_conn, rolling_stocks_ids, |missing| {
            let first_missing_id = missing
                .iter()
                .next()
                .expect("Retrieve batch fail without missing ids");
            TrainScheduleError::RollingStockNotFound {
                rolling_stock_id: *first_missing_id,
            } // TODO change error type or create specific error
        })
        .await?;

    for rolling_stock in rolling_stock_batch {
        rolling_id_to_name.insert(rolling_stock.id, rolling_stock.name.clone());
        rolling_stocks.push(rolling_stock.into());
    }

    let path = Pathfinding::retrieve(db_pool.clone(), train_schedules[0].path_id)
        .await?
        .ok_or_else(|| TrainScheduleError::PathNotFound {
            path_id: train_schedules[0].path_id,
        })?;

    use crate::modelsv2::Retrieve;
    let conn = &mut db_pool.get().await?;
    let electrical_profile_set = match scenario.electrical_profile_set_id {
        Some(Some(electrical_profile_set_id)) => {
            let electrical_profile_set_tmp =
                ElectricalProfileSet::retrieve_or_fail(conn, electrical_profile_set_id, || {
                    ElectricalProfilesError::NotFound {
                        electrical_profile_set_id,
                    }
                })
                .await?;
            Some(electrical_profile_set_tmp.id.to_string())
        }
        _ => None,
    };

    let mut stops = Vec::new();
    for waypoint in path.payload.path_waypoints.iter() {
        let stop = TrainStop {
            position: None,
            duration: waypoint.duration,
            location: Some(waypoint.location.clone()),
            on_stop_signal: waypoint.duration > 0.,
        };
        stops.push(stop);
    }

    let train_schedules = train_schedules
        .iter()
        .map(|ts| CoreTrainSchedule {
            train_name: ts.train_name.clone(),
            rolling_stock: rolling_id_to_name
                .get(&ts.rolling_stock_id)
                .unwrap()
                .to_owned(),
            initial_speed: ts.initial_speed,
            scheduled_points: ts.scheduled_points.0.to_owned(),
            allowances: ts.allowances.0.to_owned(),
            stops: stops.clone(),
            tag: ts.speed_limit_tags.clone(),
            comfort: ts.comfort.parse().unwrap(),
            power_restriction_ranges: ts
                .power_restriction_ranges
                .as_ref()
                .map(|prr| prr.0.to_owned()),
            options: ts.options.as_ref().map(|o| o.0.to_owned()),
        })
        .collect::<Vec<_>>();

    Ok(SimulationRequest {
        infra,
        rolling_stocks,
        train_schedules,
        electrical_profile_set,
        trains_path: path.into(),
    })
}

fn empty_range_to_range_of_none<T>(range: Vec<T>, len: usize) -> Vec<Option<T>>
where
    T: Clone,
{
    assert!(range.is_empty() || range.len() == len);
    range
        .into_iter()
        .map(|prr| Some(prr))
        .chain(std::iter::repeat(None))
        .take(len)
        .collect::<Vec<_>>()
}

pub fn process_simulation_response(
    simulation_response: SimulationResponse,
) -> Result<Vec<SimulationOutputChangeset>> {
    let SimulationResponse {
        base_simulations,
        eco_simulations,
        speed_limits,
        electrification_ranges,
        power_restriction_ranges,
        ..
    } = simulation_response;
    let mut simulation_outputs = Vec::new();
    if base_simulations.is_empty() {
        return Err(TrainScheduleError::NoSimulation.into());
    }
    let electrification_ranges =
        empty_range_to_range_of_none(electrification_ranges, base_simulations.len());
    let power_restriction_ranges =
        empty_range_to_range_of_none(power_restriction_ranges, base_simulations.len());

    for (base_simulation, eco_simulation, mrsp, elec_ranges, prr) in izip!(
        base_simulations,
        eco_simulations,
        speed_limits,
        electrification_ranges,
        power_restriction_ranges,
    ) {
        let eco_simulation = match eco_simulation {
            Some(eco) => Some(Some(DieselJson(eco))),
            None => Some(None),
        };
        let simulation_output = SimulationOutputChangeset {
            id: None,
            mrsp: Some(DieselJson(mrsp)),
            base_simulation: Some(DieselJson(base_simulation)),
            eco_simulation,
            electrification_ranges: elec_ranges.map(DieselJson),
            power_restriction_ranges: prr.map(DieselJson),
            train_schedule_id: Some(None), // To be filled once the train schedule is inserted
        };
        simulation_outputs.push(simulation_output);
    }
    Ok(simulation_outputs)
}

#[cfg(test)]
pub mod tests {
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
