use std::hash::DefaultHasher;
use std::hash::Hash;
use std::sync::Arc;

use core_client::AsCoreRequest as _;
use core_client::CoreClient;

use crate::CoreEnv;
use crate::Task;
use crate::envs::pathfinding;

use super::SimulationKey;
use super::SimulationWaypoint;

pub(super) fn build_request(
    core_env: &CoreEnv,
    electrical_profile_set_id: Option<u64>,
    SimulationKey(sim_consist, params, pathfinding::Input(pf_consist, constraints)): &SimulationKey,
    core_client::pathfinding::PathfindingResultSuccess {
        path,
        path_item_positions,
        backtrack_positions,
        ..
    }: core_client::pathfinding::PathfindingResultSuccess,
) -> Result<core_client::simulation::Request, ()> {
    if constraints.path_items.len() != path_item_positions.len() {
        tracing::error!(
            ?sim_consist,
            ?pf_consist,
            sim_params = ?params,
            pf_constraints = ?constraints,
            waypoint_count = constraints.path_items.len(),
            computed_path_item_count = path_item_positions.len(),
            "Core path does not respect pathfinding constraints. Please open a bug report."
        );
        return Err(());
    }
    // Thanks to SimulationTrain, all indexing from now on should be safe.
    // If any indexing below goes wrong, it's a bug.

    let mut power_restrictions = Vec::new();
    for (range, restriction) in params.power_restrictions().iter() {
        let from = path_item_positions[range.start];
        let to = path_item_positions[range.end];
        power_restrictions.push(core_client::simulation::SimulationPowerRestrictionItem {
            from,
            to,
            value: restriction.clone(),
        });
    }

    let mut margin_boundaries = Vec::<u64>::new();
    let mut margin_values = Vec::new();
    for (range, margin) in params.margins().iter() {
        let from = path_item_positions[range.start];
        let to = path_item_positions[range.end];
        if margin_boundaries.is_empty() {
            margin_boundaries.push(from);
        }
        margin_boundaries.push(to);
        margin_values.push(*margin);
    }
    debug_assert!(
        margin_boundaries.is_sorted(),
        "margin boundaries should only distributed along the path, therefore in a sorted order"
    );
    debug_assert!(
        margin_boundaries.is_empty() && margin_values.is_empty()
            || margin_boundaries.len() == margin_values.len() + 1
    );

    let mut schedule = Vec::new();
    for (i, point) in params.schedule().iter().enumerate() {
        if let SimulationWaypoint::ScheduleItem {
            arrival_at,
            stop_for,
            reception_signal,
        } = point
        {
            let position = path_item_positions[i];
            schedule.push(core_client::simulation::SimulationScheduleItem {
                path_offset: position,
                arrival: *arrival_at,
                stop_for: *stop_for,
                reception_signal: *reception_signal,
            });
        }
    }

    let margin_boundaries_len = margin_boundaries.len();
    Ok(core_client::simulation::Request {
        infra: core_env.infra_id as i64,
        expected_version: core_env.infra_version,
        electrical_profile_set_id: electrical_profile_set_id.map(|id| id as i64),
        schedule,
        margins: core_client::simulation::SimulationMargins {
            // Margins are defined on the entire path, from origin to
            // destination. Therefore, the only interesting boundaries are the
            // one in-between. Origin and Destination are not part of the API
            // contract.
            boundaries: margin_boundaries
                .into_iter()
                .skip(1)
                .take(margin_boundaries_len.saturating_sub(2))
                .collect(),
            values: margin_values,
        },
        power_restrictions,
        initial_speed: params
            .initial_speed()
            .get::<uom::si::velocity::meter_per_second>(),
        comfort: params.comfort(),
        constraint_distribution: params.constraint_distribution(),
        speed_limit_tag: params.speed_limit_tag().map(|s| s.to_owned()),
        options: params.options().clone(),
        physics_consist: sim_consist.0.clone(),
        path,
        path_item_positions,
        backtrack_positions,
    })
}

impl Task for core_client::simulation::Request {
    type Output = core_client::simulation::Response;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    // Please adjust if you have more educated information (and adjust the comment 😉).
    const CACHE_READS_BATCH_SIZE: usize = 25; // This value has been chosen this way: 🫳🎩

    fn key(&self, app_version: &str) -> String {
        use std::hash::Hasher as _;
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        let req_hash = hasher.finish().to_string();
        format!("editoast.{app_version}.simulation.{req_hash}")
    }

    async fn compute(self, ctx: Self::Context) -> Result<Self::Output, Self::Error> {
        self.fetch(ctx.as_ref()).await
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use core_client::mocking::MockingClient;
    use pretty_assertions::assert_eq;
    use schemas::primitives::NonBlankString;
    use schemas::train_schedule::MarginValue;

    use super::*;
    use crate::envs::pathfinding;
    use crate::envs::pathfinding::PathWaypointAlternatives;
    use crate::envs::simulation;
    use crate::envs::simulation::SimulationTrain;
    use crate::envs::simulation::SimulationTrainParameters;
    use crate::envs::simulation::SimulationWaypoint;

    /// Simple request with only schedule items
    #[test]
    fn build_request_no_power_restrictions_no_margins() {
        let path_item_positions = vec![0u64, 10u64];
        let path = core_client::pathfinding::TrainPath {
            blocks: Vec::new(),
            routes: Vec::new(),
            track_section_ranges: Vec::new(),
        };
        let path_success = core_client::pathfinding::PathfindingResultSuccess {
            path: path.clone(),
            length: 100,
            path_item_positions: path_item_positions.clone(),
            backtrack_positions: Vec::new(),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let path_items = vec![
            PathWaypointAlternatives::from_iter([]),
            PathWaypointAlternatives::from_iter([]),
        ];
        let pf_input = pathfinding::Input(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints {
                path_items: path_items.clone(),
            }),
        );

        let mut builder = SimulationTrain::new(
            simulation::test_data::consist(1),
            pathfinding::test_data::consist(1),
            SimulationTrainParameters::new(
                Default::default(),
                Default::default(),
                Default::default(),
                None,
                Default::default(),
            ),
        );
        builder.push_waypoint(
            path_items[0].clone(),
            NonBlankString::from("a"),
            SimulationWaypoint::PathItem,
        );
        builder.push_waypoint(
            path_items[1].clone(),
            NonBlankString::from("b"),
            SimulationWaypoint::ScheduleItem {
                arrival_at: Some(300),
                stop_for: Some(0),
                reception_signal: Default::default(),
            },
        );

        let sim_consist = builder.simulation_consist.clone();
        let sim_key = SimulationKey(
            Arc::new(sim_consist.clone()),
            Arc::new(builder.parameters),
            pf_input,
        );

        let request = build_request(&core_env, None, &sim_key, path_success).unwrap();
        let expected = core_client::simulation::Request {
            infra: 1,
            expected_version: 1,
            electrical_profile_set_id: None,
            schedule: vec![core_client::simulation::SimulationScheduleItem {
                path_offset: 10,
                arrival: Some(300),
                stop_for: Some(0),
                reception_signal: Default::default(),
            }],
            margins: core_client::simulation::SimulationMargins {
                // Core also accepts this form
                boundaries: vec![],
                values: vec![],
            },
            power_restrictions: vec![],
            initial_speed: 0.0,
            comfort: Default::default(),
            constraint_distribution: Default::default(),
            speed_limit_tag: None,
            options: Default::default(),
            physics_consist: sim_consist.0,
            path,
            path_item_positions,
            backtrack_positions: Default::default(),
        };

        assert_eq!(request, expected);
    }

    /// Complex case with overlapping margins and power restrictions, testing RangeMap iteration and coalescing
    #[test]
    fn build_request_with_overlapping_ranges() {
        let path_item_positions = vec![0u64, 10u64, 20u64, 30u64, 40u64];
        let path = core_client::pathfinding::TrainPath {
            blocks: Vec::new(),
            routes: Vec::new(),
            track_section_ranges: Vec::new(),
        };
        let path_success = core_client::pathfinding::PathfindingResultSuccess {
            path: path.clone(),
            length: 100,
            path_item_positions: path_item_positions.clone(),
            backtrack_positions: Vec::new(),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let path_items = vec![
            PathWaypointAlternatives::from_iter([]),
            PathWaypointAlternatives::from_iter([]),
            PathWaypointAlternatives::from_iter([]),
            PathWaypointAlternatives::from_iter([]),
            PathWaypointAlternatives::from_iter([]),
        ];
        let pf_input = pathfinding::Input(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints {
                path_items: path_items.clone(),
            }),
        );

        let mut builder = SimulationTrain::new(
            simulation::test_data::consist(1),
            pathfinding::test_data::consist(1),
            SimulationTrainParameters::new(
                Default::default(),
                Default::default(),
                Default::default(),
                None,
                Default::default(),
            ),
        );
        for (i, arrival) in [None, Some(100), Some(200), Some(300), Some(400)]
            .iter()
            .enumerate()
        {
            builder.push_waypoint(
                path_items[i].clone(),
                NonBlankString::from(i.to_string()),
                SimulationWaypoint::ScheduleItem {
                    arrival_at: *arrival,
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
            );
        }
        builder.set_power_restriction("0", "2", "blackout".to_owned());
        builder.set_power_restriction("1", "3", "reduced".to_owned());
        builder.set_power_restriction("3", "4", "normal".to_owned());
        builder.set_margin("0", "2", MarginValue::Percentage(10.0));
        builder.set_margin("2", "4", MarginValue::MinPer100Km(50.0));
        builder.set_margin("1", "3", MarginValue::Percentage(5.0));

        let sim_consist = builder.simulation_consist.clone();
        let sim_key = SimulationKey(
            Arc::new(sim_consist.clone()),
            Arc::new(builder.parameters),
            pf_input,
        );

        let request = build_request(&core_env, None, &sim_key, path_success).unwrap();
        let expected = core_client::simulation::Request {
            infra: 1,
            expected_version: 1,
            electrical_profile_set_id: None,
            schedule: vec![
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 0,
                    arrival: None,
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 10,
                    arrival: Some(100),
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 20,
                    arrival: Some(200),
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 30,
                    arrival: Some(300),
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 40,
                    arrival: Some(400),
                    stop_for: Some(0),
                    reception_signal: Default::default(),
                },
            ],
            margins: core_client::simulation::SimulationMargins {
                boundaries: vec![10u64, 30u64],
                values: vec![
                    MarginValue::Percentage(10.0),
                    MarginValue::Percentage(5.0),
                    MarginValue::MinPer100Km(50.0),
                ],
            },
            power_restrictions: vec![
                core_client::simulation::SimulationPowerRestrictionItem {
                    from: 0,
                    to: 10,
                    value: "blackout".to_owned(),
                },
                core_client::simulation::SimulationPowerRestrictionItem {
                    from: 10,
                    to: 30,
                    value: "reduced".to_owned(),
                },
                core_client::simulation::SimulationPowerRestrictionItem {
                    from: 30,
                    to: 40,
                    value: "normal".to_owned(),
                },
            ],
            initial_speed: 0.0,
            comfort: Default::default(),
            constraint_distribution: Default::default(),
            speed_limit_tag: None,
            options: Default::default(),
            physics_consist: sim_consist.0,
            path,
            path_item_positions,
            backtrack_positions: Default::default(),
        };

        assert_eq!(request, expected);
    }

    /// Error case when schedule count doesn't match path item count.
    /// 2 schedule items but only 1 path item
    #[test]
    fn build_request_error_schedule_path_mismatch() {
        let path_positions = vec![0u64];
        let path = core_client::pathfinding::TrainPath {
            blocks: Vec::new(),
            routes: Vec::new(),
            track_section_ranges: Vec::new(),
        };
        let path_success = core_client::pathfinding::PathfindingResultSuccess {
            path,
            length: 100,
            path_item_positions: path_positions,
            backtrack_positions: Vec::new(),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let pf_input = pathfinding::Input(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints { path_items: vec![] }),
        );

        let mut builder = SimulationTrain::new(
            simulation::test_data::consist(1),
            pathfinding::test_data::consist(1),
            SimulationTrainParameters::new(
                Default::default(),
                Default::default(),
                Default::default(),
                None,
                Default::default(),
            ),
        );
        builder.push_waypoint(
            PathWaypointAlternatives::from_iter([]),
            NonBlankString::from("a"),
            SimulationWaypoint::PathItem,
        );
        builder.push_waypoint(
            PathWaypointAlternatives::from_iter([]),
            NonBlankString::from("b"),
            SimulationWaypoint::ScheduleItem {
                arrival_at: Some(300),
                stop_for: Some(0),
                reception_signal: Default::default(),
            },
        );

        let sim_key = SimulationKey(
            Arc::new(builder.simulation_consist.clone()),
            Arc::new(builder.parameters),
            pf_input,
        );

        assert_eq!(
            build_request(&core_env, None, &sim_key, path_success),
            Err(())
        );
    }
}
