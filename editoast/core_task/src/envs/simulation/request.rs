use std::hash::DefaultHasher;
use std::hash::Hash;
use std::sync::Arc;

use core_client::AsCoreRequest as _;
use core_client::CoreClient;

use crate::CoreEnv;
use crate::Task;
use crate::envs::pathfinding;

use super::ScheduleItem;
use super::SimulationKey;

pub(super) fn build_request(
    core_env: &CoreEnv,
    electrical_profile_set_id: Option<u64>,
    SimulationKey(sim_consist, params, pathfinding::PathfindingKey(pf_consist, constraints)): &SimulationKey,
    core_client::pathfinding::PathfindingResult {
        path,
        path_item_positions,
        backtrack_path_items,
        ..
    }: core_client::pathfinding::PathfindingResult,
) -> Result<core_client::simulation::Request, ()> {
    if constraints.path_items.len() != path_item_positions.len() {
        tracing::error!(
            ?sim_consist,
            ?pf_consist,
            sim_params = ?params,
            pf_constraints = ?constraints,
            schedule_item_count = constraints.path_items.len(),
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
    for (
        i,
        ScheduleItem {
            arrival_at,
            stop_for,
            reception_signal,
        },
    ) in params.schedule_items().iter().enumerate()
    {
        let position = path_item_positions[i];
        let stop_details = stop_for.map(|duration| core_client::simulation::StopDetails {
            duration,
            reception_signal: *reception_signal,
            is_backtracking: match backtrack_path_items {
                None => false,
                Some(ref items) => items.contains(&i),
            },
        });
        schedule.push(core_client::simulation::SimulationScheduleItem {
            path_offset: position,
            arrival: *arrival_at,
            stop_details,
        });
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
    })
}

impl Task for core_client::simulation::Request {
    type Output = core_client::simulation::Response;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    // The compressed size of a simulation is:
    // - Mean: 18.5kB
    // - 50th percentile: 12.4kB
    // - Max: 163.95kB
    // Therefore, we can safely batch 50 to have around 1MB of data per request.
    const CACHE_READS_BATCH_SIZE: usize = 50;

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
    use std::collections::BTreeSet;
    use std::sync::Arc;

    use core_client::mocking::MockingClient;
    use pretty_assertions::assert_eq;
    use schemas::primitives::NonBlankString;
    use schemas::train_schedule::MarginValue;

    use super::*;
    use crate::envs::pathfinding;
    use crate::envs::pathfinding::PathItemConstraint;
    use crate::envs::simulation;
    use crate::envs::simulation::ScheduleItem;
    use crate::envs::simulation::SimulationTrain;
    use crate::envs::simulation::SimulationTrainParameters;

    /// Simple request with only schedule items
    #[test]
    fn build_request_no_power_restrictions_no_margins() {
        let path_item_positions = vec![0u64, 10u64];
        let path = core_client::pathfinding::TrainPath {
            blocks: Vec::new(),
            routes: Vec::new(),
            track_section_ranges: Vec::new(),
        };
        let path_success = core_client::pathfinding::PathfindingResult {
            path: path.clone(),
            length: 100,
            path_item_positions: path_item_positions.clone(),
            backtrack_path_items: Some(vec![]),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let path_items = vec![
            PathItemConstraint::new([], false),
            PathItemConstraint::new([], false),
        ];
        let pf_input = pathfinding::PathfindingKey(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints {
                path_items: path_items.clone(),
                allowed_track_sections: BTreeSet::new(),
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
        builder.push_schedule_item(
            path_items[0].clone(),
            NonBlankString::from("a"),
            ScheduleItem::pass_by(),
        );
        builder.push_schedule_item(
            path_items[1].clone(),
            NonBlankString::from("b"),
            ScheduleItem {
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
            schedule: vec![
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 0,
                    arrival: None,
                    stop_details: None,
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 10,
                    arrival: Some(300),
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
                },
            ],
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
        let path_success = core_client::pathfinding::PathfindingResult {
            path: path.clone(),
            length: 100,
            path_item_positions: path_item_positions.clone(),
            backtrack_path_items: Some(vec![]),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let path_items = vec![
            PathItemConstraint::new([], false),
            PathItemConstraint::new([], false),
            PathItemConstraint::new([], false),
            PathItemConstraint::new([], false),
            PathItemConstraint::new([], false),
        ];
        let pf_input = pathfinding::PathfindingKey(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints {
                path_items: path_items.clone(),
                allowed_track_sections: BTreeSet::new(),
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
            builder.push_schedule_item(
                path_items[i].clone(),
                NonBlankString::from(i.to_string()),
                ScheduleItem {
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
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 10,
                    arrival: Some(100),
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 20,
                    arrival: Some(200),
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 30,
                    arrival: Some(300),
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
                },
                core_client::simulation::SimulationScheduleItem {
                    path_offset: 40,
                    arrival: Some(400),
                    stop_details: Some(core_client::simulation::StopDetails {
                        duration: 0,
                        reception_signal: Default::default(),
                        is_backtracking: false,
                    }),
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
        let path_success = core_client::pathfinding::PathfindingResult {
            path,
            length: 100,
            path_item_positions: path_positions,
            backtrack_path_items: Some(vec![]),
        };

        let core_env = CoreEnv::new_mock(MockingClient::new());
        let pf_input = pathfinding::PathfindingKey(
            Arc::new(pathfinding::test_data::consist(1)),
            Arc::new(crate::PathfindingConstraints {
                path_items: vec![],
                allowed_track_sections: BTreeSet::new(),
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
        builder.push_schedule_item(
            PathItemConstraint::new([], false),
            NonBlankString::from("a"),
            ScheduleItem::pass_by(),
        );
        builder.push_schedule_item(
            PathItemConstraint::new([], false),
            NonBlankString::from("b"),
            ScheduleItem {
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
