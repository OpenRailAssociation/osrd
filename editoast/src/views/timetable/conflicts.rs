use std::collections::HashMap;

use chrono::Duration;
use common::units::millisecond;
use common::units::quantities::Offset;
use editoast_models::prelude::*;
use schemas::timetable_type::TimetableType;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::timetable::TimetableError;
use core_client::conflict_detection::Conflict as CoreConflict;
use core_client::conflict_detection::ConflictDetectionRequest;
use core_client::conflict_detection::ConflictRequirement;
use core_client::conflict_detection::ConflictType;
use core_client::conflict_detection::TrainRequirements;
use core_client::simulation::RoutingRequirement;
use core_client::simulation::RoutingZoneRequirement;
use core_client::simulation::SpacingRequirement;
use database::DbConnection;
use editoast_models::Infra;
use editoast_models::timetable::TimetableWithTrains;
use editoast_models::train_schedule::OccurrenceId;
use schemas::TrainOccurrence;
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

pub(super) async fn retrieve_trains(
    mut conn: DbConnection,
    timetable_id: i64,
) -> Result<(TimetableType, Vec<editoast_models::TrainSchedule>)> {
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
    paced_trains: &[editoast_models::TrainSchedule],
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

#[cfg(test)]
mod tests {
    use super::*;
    use common::units;
    use core_client::simulation::RoutingRequirement;
    use core_client::simulation::RoutingZoneRequirement;
    use core_client::simulation::SpacingRequirement;
    use rstest::rstest;

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
}
