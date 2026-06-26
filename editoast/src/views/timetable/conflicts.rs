use std::collections::HashMap;

use common::units::quantities::Offset;
use editoast_models::prelude::*;
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
use database::DbConnection;
use editoast_models::Infra;
use editoast_models::timetable::TimetableWithTrains;
use editoast_models::train_schedule::OccurrenceId;
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

pub(super) async fn retrieve_trains(
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

#[cfg(test)]
mod tests {
    use super::*;
    use common::units;
    use core_client::simulation::RoutingRequirement;
    use core_client::simulation::RoutingZoneRequirement;
    use core_client::simulation::SpacingRequirement;
    use pretty_assertions::assert_eq;
    use schemas::fixtures::ms_since_epoch;

    // Build one train schedule and one paced train with 2 occurrences
    // then check that the function 'build_conflict_core_request'
    // produce something coherent
    #[test]
    fn build_coherent_conflict_core_request() {
        // Given
        let infra = Infra::default();
        let ts_id = 13;
        let ts_start_time = ms_since_epoch("2025-01-01T08:00:00Z");

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
        let paced_start_time = ms_since_epoch("2025-01-01T09:00:00Z");
        let paced_interval = units::second::new(3600.0);

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
}
