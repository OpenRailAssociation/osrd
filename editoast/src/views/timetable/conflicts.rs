use authz::v2;
use models::TrainScheduleLinking;
use schemas::paced_train::RollingStockChangeGroup;
use std::collections::HashMap;
use std::sync::Arc;

use authz::RollingStockPrivilege;
use axum::Extension;
use axum::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use chrono::Duration;
use common::units::millisecond;
use common::units::quantities::Offset;
use itertools::Itertools as _;
use itertools::izip;
use models::prelude::*;
use schemas::timetable_type::TimetableType;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AppState;
use crate::authentication;
use crate::authorizers::SystemAuthorizer;
use crate::error::Result;
use crate::views::AuthorizationError;
use crate::views::infra::InfraIdQueryParam;
use crate::views::path::pathfinding::PathfindingResult;
use crate::views::timetable::ElectricalProfileSetIdQueryParam;
use crate::views::timetable::TimetableError;
use crate::views::timetable::TimetableIdParam;
use core_client::AsCoreRequest as _;
use core_client::conflict_detection::Conflict as CoreConflict;
use core_client::conflict_detection::ConflictDetectionRequest;
use core_client::conflict_detection::ConflictRequirement;
use core_client::conflict_detection::ConflictType;
use core_client::conflict_detection::TrainRequirements;
use core_client::simulation::RoutingRequirement;
use core_client::simulation::RoutingZoneRequirement;
use core_client::simulation::SpacingRequirement;
use database::DbConnection;
use models::Infra;
use models::timetable::TimetableWithTrains;
use models::train_schedule::OccurrenceId;
use schemas::TrainOccurrence;
use schemas::train_schedule::TrainScheduleLike as _;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct Conflict {
    /// List of trains involved in the conflict.
    #[schema(inline)]
    train_ids: Vec<OccurrenceId>,
    /// List of work schedule ids involved in the conflict
    pub work_schedule_ids: Vec<i64>,
    /// Start of the conflict time range: elapsed ms since an implicit 'request base time'.
    /// This is the *union* of all the conflicting time ranges.
    ///
    /// The implicit 'request base time' is the same as the train schedules' `start_time`
    /// frame in this timetable.
    /// Example: `1970-01-01T00:00:00Z` for calendar timetables; the timetable start for hourly
    /// timetables.
    #[serde(with = "common::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub start_time: Offset,
    /// Duration of the conflict in ms.
    pub duration: u64,
    /// Type of the conflict
    pub conflict_type: ConflictType,
    /// List of requirements causing the conflict
    pub requirements: Vec<ConflictRequirement>,
}

impl Conflict {
    /// This function processes train ids from Core Response
    ///  and maps them to either a `train_schedule_id` or a `paced_train_occurrence_id` based on the provided key mapping.
    pub(super) fn from_core_response(
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
            duration: conflict.duration,
            conflict_type: conflict.conflict_type,
            requirements: conflict.requirements,
        })
    }
}

type Interval = (u64, u64);

pub(in crate::views) async fn retrieve_trains(
    mut conn: DbConnection,
    timetable_id: i64,
) -> Result<(TimetableType, Vec<models::TrainSchedule>)> {
    let timetable_trains =
        TimetableWithTrains::retrieve_or_fail(conn.clone(), timetable_id, || {
            TimetableError::NotFound { timetable_id }
        })
        .await?;
    let trains = models::TrainSchedule::retrieve_batch_unchecked(
        &mut conn,
        timetable_trains.paced_train_ids,
    )
    .await?;

    Ok((timetable_trains.timetable_type.0, trains))
}

/// Build the core conflict detection request
pub(super) fn build_conflict_core_request(
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

pub(super) fn compute_hourly_pattern_period(
    paced_trains: &[models::TrainSchedule],
) -> Option<Duration> {
    let paced_train_lcm = paced_trains
        .iter()
        .map(|paced_train| {
            paced_train
                .time_window
                .expect("a paced_train should have a time_window")
                .num_milliseconds()
        })
        .reduce(lcm)?;
    Some(Duration::milliseconds(paced_train_lcm))
}

fn gcd(a: i64, b: i64) -> i64 {
    if b == 0 { a } else { gcd(b, a % b) }
}

fn lcm(a: i64, b: i64) -> i64 {
    (a / gcd(a, b)).saturating_mul(b)
}

pub(super) fn populate_timetable(
    period_occurrences: Vec<(OccurrenceId, TrainOccurrence)>,
    repetition: usize,
    time_window_ms: i64,
) -> Vec<(OccurrenceId, TrainOccurrence)> {
    let mut occurrences = Vec::with_capacity(period_occurrences.len() * repetition);
    for period in 0..repetition {
        for (id, occurrence) in &period_occurrences {
            let mut new_occurrence = occurrence.clone();
            new_occurrence.start_time += millisecond::i64::new(time_window_ms * period as i64);
            let new_id = id.clone();
            occurrences.push((new_id, new_occurrence));
        }
    }
    occurrences
}

/// An hourly timetable is cyclic, so we need to get back each requirement onto [0, timetable_period[.
/// To do so, each requirement is wrapped modulo the period, splitting it if it crosses the period boundary.
pub(super) fn build_cyclic_occurrence_requirements(
    train_id: OccurrenceId,
    spacing_requirements: Vec<SpacingRequirement>,
    routing_requirements: Vec<RoutingRequirement>,
    timetable_period: Duration,
) -> Vec<(OccurrenceId, TrainRequirements)> {
    let period_ms = timetable_period.num_milliseconds() as u64;

    vec![(
        train_id.clone(),
        TrainRequirements {
            spacing_requirements: split_spacing(period_ms, &spacing_requirements),
            routing_requirements: split_routing(period_ms, &routing_requirements),
        },
    )]
}

/// Wraps an interval [begin, end[ into [0, period[, splitting it if it crosses the period boundary
fn split_interval(begin: u64, end: u64, period: u64) -> Vec<Interval> {
    let duration = end - begin;
    if duration >= period {
        // Occupied the whole period
        return vec![(0, period)];
    }
    let period_begin = begin % period;

    if period_begin + duration <= period {
        vec![(period_begin, period_begin + duration)]
    } else {
        vec![
            (period_begin, period),
            (0, period_begin + duration - period),
        ]
    }
}

/// Wraps the spacing requirements into [0, period[, splitting it if it crosses the period boundary
fn split_spacing(period: u64, requirements: &[SpacingRequirement]) -> Vec<SpacingRequirement> {
    let mut split_requirements = Vec::new();
    for requirement in requirements {
        let split_requirement =
            split_interval(requirement.begin_time, requirement.end_time, period);
        split_requirements.extend(split_requirement.into_iter().map(|(begin_time, end_time)| {
            SpacingRequirement {
                zone: requirement.zone.clone(),
                begin_time,
                end_time,
            }
        }));
    }
    split_requirements
}

/// Wraps the routing requirements into [0, period[, splitting it if it crosses the period boundary
fn split_routing(period: u64, requirements: &[RoutingRequirement]) -> Vec<RoutingRequirement> {
    let mut split_requirements = Vec::new();
    for requirement in requirements {
        // All zones share a begin_time
        // The split requirement can have two possible begins: the route's position in the period (period_begin) and the origin (0)
        let period_begin = requirement.begin_time % period;
        let mut unwrapped_zones = Vec::new(); // begin = period_begin
        let mut wrapped_zones = Vec::new(); // begin = 0
        for zone in &requirement.zones {
            let split_requirement = split_interval(requirement.begin_time, zone.end_time, period);
            for (begin_time, end_time) in split_requirement {
                let zone = RoutingZoneRequirement {
                    end_time,
                    ..zone.clone()
                };
                if begin_time == 0 {
                    wrapped_zones.push(zone);
                } else {
                    unwrapped_zones.push(zone);
                }
            }
        }
        for (begin_time, zones) in [(0, wrapped_zones), (period_begin, unwrapped_zones)] {
            if !zones.is_empty() {
                split_requirements.push(RoutingRequirement {
                    route: requirement.route.clone(),
                    begin_time,
                    zones,
                });
            }
        }
    }
    split_requirements
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
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
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

    v2::infra_privilege_check(
        authz::Infra(infra_id),
        authz::InfraPrivilege::CanRestrictedRead,
    )
    .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
    .await?;

    let (timetable_type, trains) = retrieve_trains(conn.clone(), timetable_id).await?;

    let timetable_period = match timetable_type {
        TimetableType::Calendar => None,
        TimetableType::Hourly => compute_hourly_pattern_period(&trains),
    };
    // Reject a timetable period longer than 24h: an hourly timetable is not meant to span more than a day
    if let Some(timetable_period) = timetable_period
        && timetable_period > Duration::hours(24)
    {
        return Err(TimetableError::InvalidPeriod {
            timetable_period: timetable_period.num_hours(),
        }
        .into());
    }

    let train_schedules_ids = trains.iter().map(|t| t.id).collect_vec();

    let mut exceptions = models::TrainScheduleException::retrieve_exceptions_by_train_schedules(
        &mut conn.clone(),
        timetable_id,
        &train_schedules_ids,
    )
    .await?
    .into_iter()
    .map_into::<schemas::TrainScheduleException>()
    .into_group_map_by(|e| e.train_schedule_id);

    let train_schedules_with_exceptions: Vec<(
        models::TrainSchedule,
        Vec<schemas::TrainScheduleException>,
    )> = trains
        .into_iter()
        .map(|ts| {
            let ts_exceptions = exceptions.remove(&ts.id).unwrap_or_default();
            (ts, ts_exceptions)
        })
        .collect();

    let train_schedules_with_exceptions = filter_unauthorized_train_schedules_and_exceptions(
        &openfga,
        conn.clone(),
        authn_state,
        train_schedules_with_exceptions,
    )
    .await?;

    // Flatten paced trains occurrences
    let (occurrence_ids, occurrence_trains): (Vec<_>, Vec<_>) = train_schedules_with_exceptions
        .iter()
        .flat_map(|(ts, exceptions)| {
            let single_period_occurrences = ts.iter_occurrences(exceptions).collect();
            match timetable_period {
                None => single_period_occurrences,
                Some(period) => {
                    // For hourly timetable, occurrences must be duplicated to cover the timetable period (ex: a 1h mission within a 2h period)
                    let time_window_ms = ts
                        .time_window
                        .expect("all time_window are defined when timetable_period exists")
                        .num_milliseconds();
                    let repetition = (period.num_milliseconds() / time_window_ms) as usize;
                    populate_timetable(single_period_occurrences, repetition, time_window_ms)
                }
            }
        })
        .unzip();

    let (occurrence_simulations, occurrence_pathfindings): (Vec<_>, Vec<_>) =
        super::train_simulation_ordered_batch(
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
        .collect();

    let mut linkings_spacing_requirements: Vec<Vec<SpacingRequirement>> =
        vec![vec![]; occurrence_ids.len()];
    let mut linkings_routing_requirements: Vec<Vec<RoutingRequirement>> =
        vec![vec![]; occurrence_ids.len()];

    let linkings =
        get_linkings_from_train_schedules(&mut conn.clone(), timetable_id, occurrence_ids.as_ref())
            .await;
    let valid_linkings: Vec<_> = linkings
        .iter()
        .filter(|&linking| {
            is_linking_valid(
                occurrence_trains.as_ref(),
                occurrence_simulations.as_ref(),
                occurrence_pathfindings.as_ref(),
                *linking,
            )
        })
        .collect();

    // Populate linkings_spacing_requirements and linkings_routing_requirements
    valid_linkings.iter().for_each(|&linking| {
        let (spacing_requirements, routing_requirements) =
            get_linking_requirements(&occurrence_trains, &occurrence_simulations, *linking);
        linkings_spacing_requirements[linking.0] = spacing_requirements;
        linkings_routing_requirements[linking.0] = routing_requirements;
    });

    let request_items = izip!(
        occurrence_ids,
        occurrence_trains,
        occurrence_simulations,
        linkings_spacing_requirements,
        linkings_routing_requirements
    )
    .filter_map(
        |(
            train_id,
            train_schedule,
            simulation,
            occurrence_linking_spacing_requirements,
            occurrence_linking_routing_requirements,
        )| {
            let super::simulation::Response::Success(simulation) = simulation.as_ref() else {
                return None;
            };
            let respect_times = super::simulation::path_item_respect_times(
                &simulation.final_output.report_train.path_item_times,
                &train_schedule,
            )
            .into_iter()
            .all(|path_item| path_item);
            if !respect_times {
                return None;
            }
            let mut spacing_requirements = simulation.final_output.spacing_requirements.clone();
            // Add linking spacing requirements
            spacing_requirements.extend(occurrence_linking_spacing_requirements);
            let mut routing_requirements = simulation.final_output.routing_requirements.clone();
            // Add linking routing requirements
            routing_requirements.extend(occurrence_linking_routing_requirements);
            Some((
                train_id,
                super::make_requirements_absolute(
                    train_schedule.start_time(),
                    spacing_requirements,
                    routing_requirements,
                ),
            ))
        },
    )
    .flat_map(|(train_id, train_requirements)| match timetable_period {
        None => vec![(train_id, train_requirements)],
        Some(period) => build_cyclic_occurrence_requirements(
            train_id,
            train_requirements.spacing_requirements,
            train_requirements.routing_requirements,
            period,
        ),
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

/// Take a collection of train schedules and their associated exceptions and filter out those with
/// an unauthorized rolling stock. When a train schedule is filtered out all its exceptions are
/// skipped aswell, but when an exception is filtered its associated train schedule is kept if its
/// rolling stock is authorized given the provided authentication state.
pub async fn filter_unauthorized_train_schedules_and_exceptions(
    openfga: &fga::Client,
    conn: DbConnection,
    authn_state: crate::authentication::State,
    train_schedules_with_exceptions: Vec<(
        models::TrainSchedule,
        Vec<schemas::TrainScheduleException>,
    )>,
) -> crate::error::Result<Vec<(models::TrainSchedule, Vec<schemas::TrainScheduleException>)>> {
    let Some(user) = authn_state.user() else {
        return Ok(train_schedules_with_exceptions);
    };
    let system_authorizer = SystemAuthorizer::new_infallible(openfga);
    let Ok(authorized_train_schedules) =
        authz::v2::rolling_stock_list(user, RollingStockPrivilege::CanRestrictedRead)
            .authorize(&system_authorizer)
            .await?
            .access()
            .await?;
    match authorized_train_schedules {
        authz::v2::ResourcesList::All => Ok(train_schedules_with_exceptions),
        authz::v2::ResourcesList::Privileged(authorized_rs_list) => {
            let authorized_rolling_stocks: Vec<models::RollingStock> =
                models::RollingStock::retrieve_batch_unchecked(
                    &mut conn.clone(),
                    authorized_rs_list.iter().map(|rs| rs.0),
                )
                .await?;
            let authorized_rolling_stock_names: Vec<String> = authorized_rolling_stocks
                .into_iter()
                .map(|rolling_stock| rolling_stock.name)
                .collect();

            Ok(train_schedules_with_exceptions
                .into_iter()
                .filter(|(train_schedule, _)| {
                    authorized_rolling_stock_names.contains(&train_schedule.rolling_stock_name)
                })
                .map(|(train_schedule, exceptions)| {
                    (
                        train_schedule,
                        exceptions
                            .into_iter()
                            .filter(|exception| {
                                if let Some(RollingStockChangeGroup {
                                    rolling_stock_name, ..
                                }) = &exception.change_groups.rolling_stock
                                {
                                    authorized_rolling_stock_names.contains(rolling_stock_name)
                                } else {
                                    true
                                }
                            })
                            .collect(),
                    )
                })
                .collect_vec())
        }
    }
}

async fn get_linkings_from_train_schedules(
    conn: &mut DbConnection,
    timetable_id: i64,
    occurrence_ids: &[OccurrenceId],
) -> Vec<(usize, usize)> {
    let settings = SelectionSettings::new()
        .filter(move || TrainScheduleLinking::TIMETABLE_ID.eq(timetable_id));
    let linkings = TrainScheduleLinking::list(conn, settings)
        .await
        .expect("Failed to fetch linkings");
    let flattened_occurrence_ids: Vec<(i64, Option<i64>, Option<i64>)> = occurrence_ids
        .iter()
        .map(|occurrence| {
            (
                occurrence.train_schedule_id(),
                occurrence.index().map(|v| v as i64),
                occurrence.added_exception_id(),
            )
        })
        .collect();
    let mut occurrence_linkings: Vec<(usize, usize)> = vec![];
    for linking in linkings {
        let source_index = flattened_occurrence_ids.iter().position(|&occurrence| {
            // Workaround because OccurrenceId enum doesn't make any difference between a unique train and a paced occurrence
            let occurrence_index = if linking.source_added_exception_id.is_some() {
                None
            } else {
                linking.source_occurrence_index.or(Some(0))
            };
            occurrence
                == (
                    linking.source_train_schedule_id,
                    occurrence_index,
                    linking.source_added_exception_id,
                )
        });
        let target_index = flattened_occurrence_ids.iter().position(|&occurrence| {
            // Workaround because OccurrenceId enum doesn't make any difference between a unique train and a paced occurrence
            let occurrence_index = if linking.target_added_exception_id.is_some() {
                None
            } else {
                linking.target_occurrence_index.or(Some(0))
            };
            occurrence
                == (
                    linking.target_train_schedule_id,
                    occurrence_index,
                    linking.target_added_exception_id,
                )
        });
        if let (Some(source_index), Some(target_index)) = (source_index, target_index) {
            occurrence_linkings.push((source_index, target_index))
        }
    }
    occurrence_linkings
}

fn is_linking_valid(
    occurrence_trains: &[TrainOccurrence],
    occurrence_simulations: &[Arc<super::simulation::Response>],
    occurrence_pathfindings: &[Arc<PathfindingResult>],
    (source_index, target_index): (usize, usize),
) -> bool {
    let source_occurrence = &occurrence_trains[source_index];
    let target_occurrence = &occurrence_trains[target_index];
    let source_simulation = &occurrence_simulations[source_index];
    let source_pathfinding = &occurrence_pathfindings[source_index];
    let target_pathfinding = &occurrence_pathfindings[target_index];

    let (
        PathfindingResult::Success(source_pathfinding),
        PathfindingResult::Success(target_pathfinding),
    ) = (source_pathfinding.as_ref(), target_pathfinding.as_ref())
    else {
        return false;
    };
    let source_last_track_range = source_pathfinding
        .path
        .track_section_ranges
        .last()
        .expect("Pathfinding's section ranges can't be empty");

    let target_first_track_range = target_pathfinding
        .path
        .track_section_ranges
        .first()
        .expect("Pathfinding's section ranges can't be empty");

    if source_last_track_range.track_section != target_first_track_range.track_section
        || source_last_track_range.stop() != target_first_track_range.start()
    {
        return false;
    }
    let super::simulation::Response::Success(source_simulation) = source_simulation.as_ref() else {
        return false;
    };
    let source_simulation_duration = millisecond::i64::new(
        *source_simulation
            .final_output
            .report_train
            .times
            .last()
            .expect("times should not be empty") as i64,
    );
    let source_end_time = source_occurrence.start_time() + source_simulation_duration;
    // The source train arrives after the target train starts
    if source_end_time > target_occurrence.start_time() {
        return false;
    }
    let source_arrival_schedule_item = source_occurrence
        .schedule
        .last()
        .expect("The train schedule should not be empty");
    // The source train's arrival is not a stop
    if source_arrival_schedule_item.stop_for.is_none() {
        return false;
    }
    // The target train's initial speed is not zero
    if target_occurrence.initial_speed != 0.0 {
        return false;
    }
    true
}

/// To compute the requirements caused by a linking, we filter the requirements whose end time matches
/// the simulation's end time, and we create new identical requirements with the source's end time and
/// target's start time as the begin time and end time
fn get_linking_requirements(
    occurrence_trains: &[TrainOccurrence],
    occurrence_simulations: &[Arc<super::simulation::Response>],
    (source_index, target_index): (usize, usize),
) -> (Vec<SpacingRequirement>, Vec<RoutingRequirement>) {
    let super::simulation::Response::Success(source_simulation) =
        occurrence_simulations[source_index].as_ref()
    else {
        return (vec![], vec![]);
    };
    let source_occurrence = &occurrence_trains[source_index];
    let target_occurrence = &occurrence_trains[target_index];
    let final_output = &source_simulation.final_output;
    let spacing_requirements = final_output.spacing_requirements.clone();
    let routing_requirements = final_output.routing_requirements.clone();

    // The origin for the times is the beginning of the source occurrence
    let source_end_time = *final_output
        .report_train
        .times
        .last()
        .expect("times should not be empty");
    let target_start_time = (target_occurrence.start_time() - source_occurrence.start_time())
        .get::<uom::si::time::millisecond>() as u64;

    let final_spacing_requirements = spacing_requirements
        .into_iter()
        // The requirement's end time must be close (within 10 ms) to the simulation end time
        .filter(|requirement| source_end_time.abs_diff(requirement.end_time) <= 10);
    let occurrence_linking_spacing_requirements = final_spacing_requirements
        .map(|mut requirement| {
            requirement.begin_time = source_end_time;
            requirement.end_time = target_start_time;
            requirement
        })
        .collect();

    let final_routing_requirements: Vec<_> = routing_requirements
        .into_iter()
        .map(|mut requirement| {
            requirement
                .zones
                // The zone's end time must be close (within 10 ms) to the simulation end time
                .retain(|zone| source_end_time.abs_diff(zone.end_time) <= 10);
            requirement
        })
        .filter(|requirement| !requirement.zones.is_empty())
        .collect();
    let occurrence_linking_routing_requirements: Vec<_> = final_routing_requirements
        .into_iter()
        .map(|mut requirement| {
            requirement.begin_time = source_end_time;
            requirement.zones = requirement
                .zones
                .into_iter()
                .map(|mut zone| {
                    zone.end_time = target_start_time;
                    zone
                })
                .collect();
            requirement
        })
        .collect();
    (
        occurrence_linking_spacing_requirements,
        occurrence_linking_routing_requirements,
    )
}

#[cfg(test)]
mod tests {
    use crate::error::InternalError;
    use crate::fixtures::create_fast_rolling_stock;
    use crate::fixtures::create_hourly_timetable_with_train_schedule_set;
    use crate::fixtures::create_small_infra;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::fixtures::create_train_schedule_exception;
    use crate::fixtures::simple_paced_train_base;
    use crate::fixtures::simple_paced_train_changeset;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;
    use crate::views::timetable::simulation::Response;
    use crate::views::timetable::simulation::SimulationResponseSuccess;

    use super::*;
    use authz::InfraGrant;
    use authz::RollingStockGrant;
    use common::units;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrackRange;
    use core_client::pathfinding::TrainPath;
    use core_client::simulation::CompleteReportTrain;
    use core_client::simulation::ElectricalProfiles;
    use core_client::simulation::ReportTrain;
    use core_client::simulation::RoutingRequirement;
    use core_client::simulation::RoutingZoneRequirement;
    use core_client::simulation::SpacingRequirement;
    use core_client::simulation::SpeedLimitProperties;
    use models::train_schedule::TrainScheduleChangeset;
    use reqwest::StatusCode;
    use rstest::rstest;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::infra::Direction;
    use schemas::paced_train::RollingStockChangeGroup;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::ReceptionSignal;

    fn spacing(zone: &str, begin_time: u64, end_time: u64) -> SpacingRequirement {
        SpacingRequirement {
            zone: zone.to_string(),
            begin_time,
            end_time,
        }
    }

    fn routing(route: &str, begin_time: u64, end_time: u64) -> RoutingRequirement {
        RoutingRequirement {
            route: route.to_string(),
            begin_time,
            zones: vec![RoutingZoneRequirement {
                zone: format!("{route}_ZONE"),
                entry_detector: "D_1".to_string(),
                exit_detector: "D_2".to_string(),
                switches: HashMap::new(),
                end_time,
            }],
        }
    }

    #[rstest]
    // Entirely inside the period, no boundary crossing.
    #[case::no_wrap(100, 300, 1000, vec![(100, 300)])]
    // Crosses the period boundary: split in two (up to the boundary, then from 0).
    #[case::wrap_first_period(900, 1100, 1000, vec![(900, 1000), (0, 100)])]
    // Lasts a whole period or more: saturates to the entire period.
    #[case::duration_exceeds_period(100, 1500, 1000, vec![(0, 1000)])]
    // Starts in a later period, no crossing: a single wrapped part.
    #[case::beyond_first_period_no_wrap(1200, 1300, 1000, vec![(200, 300)])]
    // Starts in a later period and crosses the boundary: two parts.
    #[case::beyond_first_period_wrap(1500, 2100, 1000, vec![(500, 1000), (0, 100)])]
    fn split_interval_cases(
        #[case] begin: u64,
        #[case] end: u64,
        #[case] period: u64,
        #[case] expected: Vec<Interval>,
    ) {
        assert_eq!(split_interval(begin, end, period), expected);
    }

    fn routing_zone(name: &str, end_time: u64) -> RoutingZoneRequirement {
        RoutingZoneRequirement {
            zone: name.to_string(),
            entry_detector: "D1".to_string(),
            exit_detector: "D2".to_string(),
            switches: HashMap::new(),
            end_time,
        }
    }

    fn routing_req(begin_time: u64, zones: Vec<RoutingZoneRequirement>) -> RoutingRequirement {
        RoutingRequirement {
            route: "R".to_string(),
            begin_time,
            zones,
        }
    }

    #[rstest]
    // One zone whose reservation crosses the boundary: wrapped part from 0, then unwrapped part
    // at period_begin.
    #[case::wrap_first_period(
        vec![routing_req(800, vec![routing_zone("Z1", 1200)])],
        vec![
            routing_req(0, vec![routing_zone("Z1", 200)]),
            routing_req(800, vec![routing_zone("Z1", 1000)]),
        ],
    )]
    // begin_time beyond the period, no crossing: a single requirement at period_begin.
    #[case::begin_beyond_period(
        vec![routing_req(1700, vec![routing_zone("Z1", 1800), routing_zone("Z2", 1900)])],
        vec![routing_req(700, vec![routing_zone("Z1", 800), routing_zone("Z2", 900)])],
    )]
    // begin_time beyond the period and the zone crosses the boundary: wrapped + unwrapped groups.
    #[case::begin_beyond_period_wrap(
        vec![routing_req(1700, vec![routing_zone("Z", 2600)])],
        vec![
            routing_req(0, vec![routing_zone("Z", 600)]),
            routing_req(700, vec![routing_zone("Z", 1000)]),
        ],
    )]
    fn split_routing_cases(
        #[case] reqs: Vec<RoutingRequirement>,
        #[case] expected: Vec<RoutingRequirement>,
    ) {
        let period = 1000;
        assert_eq!(split_routing(period, &reqs), expected);
    }

    #[test]
    fn populate_timetable_duplicates_occurrences() {
        // A 1h mission with two occurrences (at 0 and 30min), duplicated 3 times to fill a 3h period.
        let occurrences = [0, 1_800_000]
            .into_iter()
            .enumerate()
            .map(|(index, start_ms)| {
                (
                    OccurrenceId::new_base(1, index),
                    TrainOccurrence {
                        start_time: units::millisecond::i64::new(start_ms),
                        ..TrainOccurrence::fake()
                    },
                )
            })
            .collect();

        let result = populate_timetable(occurrences, 3, 3_600_000);

        let starts: Vec<i64> = result
            .iter()
            .map(|(_, occurrence)| units::millisecond::i64::from(occurrence.start_time))
            .collect();
        assert_eq!(
            starts,
            vec![0, 1_800_000, 3_600_000, 5_400_000, 7_200_000, 9_000_000]
        );

        let ids: Vec<_> = result.into_iter().map(|(id, _)| id).collect();
        assert_eq!(
            ids,
            vec![
                OccurrenceId::new_base(1, 0),
                OccurrenceId::new_base(1, 1),
                OccurrenceId::new_base(1, 0),
                OccurrenceId::new_base(1, 1),
                OccurrenceId::new_base(1, 0),
                OccurrenceId::new_base(1, 1),
            ]
        );
    }

    // Build one train schedule and one paced train with 2 occurrences
    // then check that the function 'build_conflict_core_request'
    // produce something coherent
    #[test]
    fn build_coherent_conflict_core_request() {
        let infra = Infra::default();
        let ts_id = 13;
        let paced_train_id = 42;

        let train_schedule = OccurrenceId::new_base(ts_id, 0);
        let paced_occurrence_0 = OccurrenceId::new_base(paced_train_id, 0);
        let paced_occurrence_1 = OccurrenceId::new_base(paced_train_id, 1);

        let train_schedule_requirements = TrainRequirements {
            spacing_requirements: vec![spacing("TS_ZONE", 0, 7)],
            routing_requirements: vec![routing("TS_ROUTE", 12, 15)],
        };
        let paced_occurrence_0_requirements = TrainRequirements {
            spacing_requirements: vec![spacing("PACED_ZONE", 0, 7)],
            routing_requirements: vec![routing("PACED_ROUTE", 12, 15)],
        };
        // Same mission as occurrence 0, one period later.
        let paced_occurrence_1_requirements = TrainRequirements {
            spacing_requirements: vec![spacing("PACED_ZONE", 3_600_000, 3_600_007)],
            routing_requirements: vec![routing("PACED_ROUTE", 3_600_012, 3_600_015)],
        };

        let items = vec![
            (
                paced_occurrence_0.clone(),
                paced_occurrence_0_requirements.clone(),
            ),
            (
                paced_occurrence_1.clone(),
                paced_occurrence_1_requirements.clone(),
            ),
            (train_schedule.clone(), train_schedule_requirements.clone()),
        ];

        let (trains_ids_map, conflict_core_request) =
            build_conflict_core_request(infra, items.into_iter());

        assert_eq!(conflict_core_request.trains_requirements.len(), 3);

        let assert_requirements = |occurrence: &OccurrenceId, expected: &TrainRequirements| {
            let core_id = trains_ids_map
                .iter()
                .find_map(|(core_id, mapped)| (mapped == occurrence).then_some(core_id))
                .expect("occurrence should be mapped to a core id");
            let actual = conflict_core_request
                .trains_requirements
                .get(core_id)
                .expect("core id should carry requirements");
            assert_eq!(actual.spacing_requirements, expected.spacing_requirements);
            assert_eq!(actual.routing_requirements, expected.routing_requirements);
        };

        assert_requirements(&train_schedule, &train_schedule_requirements);
        assert_requirements(&paced_occurrence_0, &paced_occurrence_0_requirements);
        assert_requirements(&paced_occurrence_1, &paced_occurrence_1_requirements);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn conflicts_hourly_rejects_period_over_24h() {
        let app = test_app!().build();
        let pool = app.db_pool();

        let infra = create_small_infra(&mut pool.get_ok()).await;
        let (timetable, train_schedule_set) =
            create_hourly_timetable_with_train_schedule_set(&mut pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;

        // Period = 5 * 7 = 35h.
        for time_window in [5, 7] {
            let mut base = simple_paced_train_base();
            base.train_occurrence.start_time = units::millisecond::i64::new(0);
            base.paced.as_mut().unwrap().time_window =
                Duration::hours(time_window).try_into().unwrap();
            base.paced.as_mut().unwrap().interval = Duration::hours(1).try_into().unwrap();
            TrainScheduleChangeset::from(base)
                .train_schedule_set_id(train_schedule_set.id)
                .create(&mut pool.get_ok())
                .await
                .expect("Failed to create paced train");
        }

        let response: InternalError = app
            .get(
                format!(
                    "/timetable/{}/conflicts?infra_id={}",
                    timetable.id, infra.id
                )
                .as_str(),
            )
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .json();
        assert_eq!(response.error_type, "editoast:timetable:InvalidPeriod");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn filter_unauthorized_train_schedules() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let rs_authorized = create_fast_rolling_stock(&mut pool.get_ok(), "authorized_rs").await;
        let rs_no_grant = create_fast_rolling_stock(&mut pool.get_ok(), "forbidden_rs").await;
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule_authorized = simple_paced_train_changeset(train_schedule_set.id)
            .train_name("train_schedule_authorized".into())
            .rolling_stock_name(rs_authorized.name.clone())
            .create(&mut pool.get_ok())
            .await
            .expect("failed to create train schedule");
        let train_schedule_unauthorized_exception =
            simple_paced_train_changeset(train_schedule_set.id)
                .train_name("train_schedule_forbidden_exception".into())
                .rolling_stock_name(rs_authorized.name.clone())
                .create(&mut pool.get_ok())
                .await
                .expect("failed to create train schedule");
        let train_schedule_unauthorized = simple_paced_train_changeset(train_schedule_set.id)
            .train_name("train_schedule_no_grant".into())
            .rolling_stock_name(rs_no_grant.name.clone())
            .create(&mut pool.get_ok())
            .await
            .expect("failed to create train schedule");
        let change_group_authorized = TrainScheduleExceptionChangeGroups {
            rolling_stock: Some(RollingStockChangeGroup {
                rolling_stock_name: rs_authorized.name.clone(),
                comfort: Comfort::AirConditioning,
            }),
            ..Default::default()
        };
        let change_group_no_grant = TrainScheduleExceptionChangeGroups {
            rolling_stock: Some(RollingStockChangeGroup {
                rolling_stock_name: rs_no_grant.name.clone(),
                comfort: Comfort::AirConditioning,
            }),
            ..Default::default()
        };
        let exception_authorized: schemas::TrainScheduleException =
            create_train_schedule_exception(
                &mut pool.get_ok(),
                timetable.id,
                train_schedule_authorized.id,
                None,
                None,
                Some(change_group_authorized),
            )
            .await
            .into();
        let exception_unauthorized: schemas::TrainScheduleException =
            create_train_schedule_exception(
                &mut pool.get_ok(),
                timetable.id,
                train_schedule_authorized.id,
                None,
                None,
                Some(change_group_no_grant),
            )
            .await
            .into();

        let openfga = app.openfga();

        let user = app
            .user("user", "User")
            .with_rolling_stock_grant(rs_authorized.id, RollingStockGrant::Reader)
            .create()
            .await;
        let authn_state = crate::authentication::State::Authenticated {
            user: authz::User(user.id),
            roles: vec![],
        };
        let train_schedules_with_exceptions = vec![
            (
                train_schedule_authorized.clone(),
                vec![exception_authorized.clone()],
            ),
            (
                train_schedule_unauthorized_exception.clone(),
                vec![exception_unauthorized],
            ),
            (train_schedule_unauthorized, vec![]),
        ];
        let authorized_train_schedules = filter_unauthorized_train_schedules_and_exceptions(
            openfga,
            pool.get_ok(),
            authn_state,
            train_schedules_with_exceptions,
        )
        .await
        .expect("the authorization filter method should succeed");
        let expected_response = vec![
            (train_schedule_authorized, vec![exception_authorized]),
            (train_schedule_unauthorized_exception, vec![]),
        ];
        assert_eq!(expected_response, authorized_train_schedules);
    }

    fn fake_report_train() -> ReportTrain {
        ReportTrain {
            positions: vec![0, 1000, 2000],
            times: vec![0, 2000, 4000],
            speeds: vec![0.0, 10.0, 0.0],
            energy_consumption: 100.0,
            path_item_times: vec![0, 4000],
        }
    }

    fn fake_complete_report_train() -> CompleteReportTrain {
        CompleteReportTrain {
            report_train: fake_report_train(),
            signal_critical_positions: vec![],
            zone_updates: vec![],
            spacing_requirements: vec![],
            routing_requirements: vec![],
        }
    }

    fn fake_occurrence_simulation_success() -> SimulationResponseSuccess {
        SimulationResponseSuccess {
            base: fake_report_train(),
            provisional: fake_report_train(),
            final_output: fake_complete_report_train(),
            mrsp: SpeedLimitProperties {
                boundaries: vec![],
                values: vec![],
            },
            electrical_profiles: ElectricalProfiles {
                boundaries: vec![],
                values: vec![],
            },
        }
    }

    #[rstest]
    #[case::valid(10000, "track_1", "track_1", 2000, true, 0.0, true)]
    #[case::invalid_source_arrival_after_target_start(
        6000, "track_1", "track_1", 2000, true, 0.0, false
    )]
    #[case::invalid_unmatched_locations(10000, "track_1", "track_2", 2000, true, 0.0, false)]
    #[case::invalid_unmatched_endpoints(10000, "track_1", "track_1", 3000, true, 0.0, false)]
    #[case::invalid_source_final_not_stop(10000, "track_1", "track_1", 2000, false, 0.0, false)]
    #[case::invalide_target_initial_speed(10000, "track_1", "track_1", 2000, true, 100.0, false)]
    fn filter_valid_linkings(
        #[case] target_start_time: i64,
        #[case] source_track: &str,
        #[case] target_track: &str,
        #[case] source_last_stop: u64,
        #[case] source_arrival_is_stop: bool,
        #[case] target_initial_speed: f64,
        #[case] is_valid: bool,
    ) {
        let mut source_occurrence = TrainOccurrence {
            start_time: millisecond::i64::new(5000),
            ..TrainOccurrence::fake()
        };

        let source_arrival_schedule_item = source_occurrence
            .schedule
            .last_mut()
            .expect("Schedule cannot be empty");
        if source_arrival_is_stop {
            source_arrival_schedule_item.stop_for = Some(Default::default());
            source_arrival_schedule_item.reception_signal = ReceptionSignal::Stop;
        } else {
            source_arrival_schedule_item.stop_for = None;
            source_arrival_schedule_item.reception_signal = ReceptionSignal::Open;
        }

        let target_occurrence = TrainOccurrence {
            start_time: millisecond::i64::new(target_start_time),
            initial_speed: target_initial_speed,
            ..TrainOccurrence::fake()
        };

        let source_simulation = Response::Success(fake_occurrence_simulation_success());
        let target_simulation = Response::Success(fake_occurrence_simulation_success());

        // Create mock pathfinding results with track section ranges
        let source_pathfinding = PathfindingResult::Success(PathfindingResultSuccess {
            path: TrainPath {
                track_section_ranges: vec![
                    TrackRange {
                        track_section: "TA0".into(),
                        begin: 0,
                        end: 1000,
                        direction: Direction::StartToStop,
                    },
                    TrackRange {
                        track_section: source_track.into(),
                        begin: 0,
                        end: source_last_stop,
                        direction: Direction::StartToStop,
                    },
                ],
                ..Default::default()
            },
            ..Default::default()
        });

        let target_pathfinding = PathfindingResult::Success(PathfindingResultSuccess {
            path: TrainPath {
                track_section_ranges: vec![
                    TrackRange {
                        track_section: target_track.into(),
                        begin: 200,
                        end: 2000,
                        direction: Direction::StopToStart,
                    },
                    TrackRange {
                        track_section: "TA1".into(),
                        begin: 0,
                        end: 2000,
                        direction: Direction::StartToStop,
                    },
                ],
                ..Default::default()
            },
            ..Default::default()
        });

        assert_eq!(
            is_linking_valid(
                &[source_occurrence, target_occurrence],
                &[Arc::new(source_simulation), Arc::new(target_simulation)],
                &[Arc::new(source_pathfinding), Arc::new(target_pathfinding)],
                (0, 1)
            ),
            is_valid
        );
    }

    #[test]
    fn get_linking_requirements_extends_requirements_to_target_start() {
        let source_occurrence = TrainOccurrence {
            start_time: millisecond::i64::new(5000),
            ..TrainOccurrence::fake()
        };
        let target_occurrence = TrainOccurrence {
            start_time: millisecond::i64::new(10000),
            ..TrainOccurrence::fake()
        };
        let mut simulation = fake_occurrence_simulation_success();
        simulation.final_output.spacing_requirements = vec![
            spacing("handoff_zone", 3000, 4000),
            spacing("ignored_zone", 1000, 2000),
        ];
        simulation.final_output.routing_requirements = vec![RoutingRequirement {
            route: "handoff_route".into(),
            begin_time: 2500,
            zones: vec![
                routing_zone("handoff_zone", 4000),
                routing_zone("ignored_zone", 2000),
            ],
        }];

        let (spacing_requirements, routing_requirements) = get_linking_requirements(
            &[source_occurrence, target_occurrence],
            &[
                Arc::new(Response::Success(simulation)),
                Arc::new(Response::Success(fake_occurrence_simulation_success())),
            ],
            (0, 1),
        );

        assert_eq!(
            spacing_requirements,
            vec![spacing("handoff_zone", 4000, 5000)]
        );
        assert_eq!(
            routing_requirements,
            vec![RoutingRequirement {
                route: "handoff_route".into(),
                begin_time: 4000,
                zones: vec![routing_zone("handoff_zone", 5000)],
            }]
        );
    }
}
