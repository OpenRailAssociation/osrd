use core_client::simulation::PhysicsConsist;
use itertools::MultiUnzip as _;
use schemas::primitives::NonBlankString;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::Distribution;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::ReceptionSignal;
use schemas::train_schedule::TrainScheduleOptions;

use std::borrow::Borrow;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Arc;

use crate::Correlated;
use crate::PathfindingConsist;
use crate::PathfindingConstraints;
use crate::PathfindingTrain;
use crate::TrainKey;
use crate::envs::pathfinding::PathWaypointAlternatives;

#[derive(Debug)]
pub(crate) struct SimulationInputs<Train>
where
    Train: TrainKey + 'static,
{
    pub(super) electrical_profile_set_id: Option<u64>,

    // TODO: deduplicate values
    pub(super) consists: HashMap<Train, Arc<SimulationConsist>>,
    pub(super) parameters: HashMap<Train, Arc<SimulationTrainParameters>>,
}

#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct SimulationConsist(pub PhysicsConsist);

/// Simulation parameters for [SimulationEnv](super::SimulationEnv)
///
/// Use [SimulationTrain] to ensure consistency with the pathfinding constraints.
#[derive(Debug, educe::Educe)]
#[educe(Hash, PartialEq, Eq)]
pub struct SimulationTrainParameters {
    path_items: Vec<SimulationWaypoint>,
    power_restrictions: rangemap::RangeMap<PathWaypointIndex, String>,
    margins: rangemap::RangeMap<PathWaypointIndex, MarginValue>,

    #[educe(Hash(method(common::units::meter_per_second::hash)))]
    #[educe(Eq(method(common::units::meter_per_second::eq)))]
    initial_speed: uom::si::f64::Velocity,
    constraint_distribution: Distribution,
    comfort: Comfort,
    speed_limit_tag: Option<String>,
    options: TrainScheduleOptions,
}

/// Schedule information for a path waypoint
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum SimulationWaypoint {
    /// No specific requirement
    PathItem,
    /// The train must stop at this waypoint
    ScheduleItem {
        stop_for: Option<u64>,
        arrival_at: Option<u64>,
        reception_signal: ReceptionSignal,
    },
}

impl SimulationTrainParameters {
    pub fn new(
        initial_speed: uom::si::f64::Velocity,
        constraint_distribution: Distribution,
        comfort: Comfort,
        speed_limit_tag: Option<String>,
        options: TrainScheduleOptions,
    ) -> Self {
        Self {
            path_items: Default::default(),
            power_restrictions: Default::default(),
            margins: Default::default(),
            initial_speed,
            constraint_distribution,
            comfort,
            speed_limit_tag,
            options,
        }
    }

    pub fn schedule(&self) -> &[SimulationWaypoint] {
        &self.path_items
    }

    pub fn power_restrictions(&self) -> &rangemap::RangeMap<PathWaypointIndex, String> {
        &self.power_restrictions
    }

    pub fn margins(&self) -> &rangemap::RangeMap<PathWaypointIndex, MarginValue> {
        &self.margins
    }

    pub fn initial_speed(&self) -> uom::si::f64::Velocity {
        self.initial_speed
    }

    pub fn constraint_distribution(&self) -> Distribution {
        self.constraint_distribution
    }

    pub fn comfort(&self) -> Comfort {
        self.comfort
    }

    pub fn speed_limit_tag(&self) -> Option<&str> {
        self.speed_limit_tag.as_deref()
    }

    pub fn options(&self) -> &TrainScheduleOptions {
        &self.options
    }

    fn is_empty(&self) -> bool {
        self.path_items.is_empty() && self.power_restrictions.is_empty() && self.margins.is_empty()
    }
}

impl<Train> SimulationInputs<Train>
where
    Train: TrainKey + 'static,
{
    pub(super) fn iter(
        &self,
        pathfinding_inputs: &super::PathfindingEnvInputs<Train>,
    ) -> impl Iterator<Item = Correlated<Train, Option<super::SimulationKey>>> {
        self.consists.keys().map(|train| {
            let simulation_key = self.train_input(train, pathfinding_inputs);
            Correlated::new(train.clone(), simulation_key)
        })
    }

    pub(super) fn train_input(
        &self,
        train: &Train,
        pathfinding_inputs: &super::PathfindingEnvInputs<Train>,
    ) -> Option<super::SimulationKey> {
        let consist = self.consists.get(train)?;
        let params = self.parameters.get(train)?;
        let pf_input = pathfinding_inputs.train_input(train)?;
        Some(super::SimulationKey(
            consist.clone(),
            params.clone(),
            pf_input,
        ))
    }
}

/// The way to provide simulation and pathfinding inputs to a [SimulationEnv]
///
/// This builder is useful to ensure the following things are consistent:
/// - pathfinding waypoints and schedule information ([SimulationWaypointSchedule])
/// - power restrictions ranges
/// - margin ranges
///
/// Providing a bunch of [SimulationTrain]s to a [SimulationEnv] using [Extend]
/// fills both the [SimulationEnv] and its inner [PathfindingEnv].
pub struct SimulationTrain {
    pub(super) simulation_consist: SimulationConsist,
    pub(super) pathfinding_consist: PathfindingConsist,
    pub(super) parameters: SimulationTrainParameters,
    pub(super) path_constraints: PathfindingConstraints,
    path_item_to_index: HashMap<NonBlankString, PathWaypointIndex>,
}

type PathWaypointIndex = usize;

impl SimulationTrain {
    pub fn new(
        simulation_consist: SimulationConsist,
        pathfinding_consist: PathfindingConsist,
        parameters: SimulationTrainParameters,
    ) -> Self {
        if !parameters.is_empty() {
            // would cause inconsistencies with the empty path constraints vec below
            panic!("cannot provide parameters with schedule, power restrictions or margins set");
        }
        Self {
            simulation_consist,
            pathfinding_consist,
            parameters,
            path_constraints: PathfindingConstraints {
                path_items: Vec::new(),
            },
            path_item_to_index: HashMap::default(),
        }
    }

    fn waypoints(&self) -> usize {
        let n = self.path_constraints.path_items.len();
        debug_assert_eq!(n, self.parameters.path_items.len());
        debug_assert!(
            self.parameters
                .power_restrictions
                .iter()
                .map(|(index_range, _power_restriction)| index_range.end)
                .max()
                <= Some(n)
        );
        debug_assert!(self.parameters.margins.iter().map(|e| e.0.end).max() <= Some(n));
        n
    }

    /// Adds a waypoint to the train's path with simulation schedule information
    ///
    /// The label can be reused for [Self::set_power_restriction] and [Self::set_margin].
    pub fn push_waypoint(
        &mut self,
        path_constraint: PathWaypointAlternatives,
        label: NonBlankString,
        point: SimulationWaypoint,
    ) {
        let index = self.parameters.path_items.len();
        self.parameters.path_items.push(point);
        self.path_constraints.path_items.push(path_constraint);
        self.path_item_to_index.insert(label, index);
    }

    /// Sets a power restriction for a range of waypoints.
    ///
    /// Labels are used to define the range: they can be &NonBlankString, &String or &str.
    ///
    /// # Panics
    ///
    /// Panics if `begin_label` or `end_label` has not been used to push a waypoint.
    pub fn set_power_restriction<Q>(&mut self, begin_label: &Q, end_label: &Q, restriction: String)
    where
        NonBlankString: Borrow<Q>,
        Q: Hash + Eq + ?Sized,
    {
        let begin_index = self
            .path_item_to_index
            .get(begin_label)
            .copied()
            .expect("only names already inserted through “push_waypoint” can be used");
        let end_index = self
            .path_item_to_index
            .get(end_label)
            .copied()
            .expect("only names already inserted through “push_waypoint” can be used");
        let n = self.waypoints();
        if begin_index >= n || end_index >= n {
            panic!("path waypoint index out of bounds");
        }
        match begin_index.cmp(&end_index) {
            Ordering::Less => self
                .parameters
                .power_restrictions
                .insert(begin_index..end_index, restriction),
            Ordering::Equal => tracing::warn!("ignoring a zero-length power restriction"),
            Ordering::Greater => panic!(
                "power restriction must be defined on strictly increasing offset along the path"
            ),
        }
    }

    /// Sets a margin for a range of waypoints.
    ///
    /// Labels are used to define the range: they can be &NonBlankString, &String or &str.
    ///
    /// # Panics
    ///
    /// Panics if `begin_label` or `end_label` has not been used to push a waypoint.
    pub fn set_margin<Q>(&mut self, begin_label: &Q, end_label: &Q, margin: MarginValue)
    where
        NonBlankString: Borrow<Q>,
        Q: Hash + Eq + ?Sized,
    {
        let begin_index = self
            .path_item_to_index
            .get(begin_label)
            .copied()
            .expect("only names already inserted through “push_waypoint” can be used");
        let end_index = self
            .path_item_to_index
            .get(end_label)
            .copied()
            .expect("only names already inserted through “push_waypoint” can be used");
        let n = self.waypoints();
        if begin_index >= n || end_index >= n {
            panic!("path waypoint index out of bounds");
        }
        match begin_index.cmp(&end_index) {
            Ordering::Less => self
                .parameters
                .margins
                .insert(begin_index..end_index, margin),
            Ordering::Equal => tracing::warn!("ignoring a zero-length margin"),
            Ordering::Greater => {
                panic!("margin must be defined on strictly increasing offset along the path")
            }
        }
    }
}

impl<Train> Extend<(Train, SimulationTrain)> for super::SimulationEnv<Train>
where
    Train: TrainKey + 'static,
{
    fn extend<T: IntoIterator<Item = (Train, SimulationTrain)>>(&mut self, iter: T) {
        let (simulation_consists, simulation_params, pathfinding_trains): (Vec<_>, Vec<_>, Vec<_>) =
            iter.into_iter()
                .map(
                    |(
                        train,
                        SimulationTrain {
                            simulation_consist,
                            pathfinding_consist,
                            parameters,
                            path_constraints,
                            path_item_to_index: _,
                        },
                    )| {
                        (
                            (train.clone(), Arc::new(simulation_consist)),
                            (train.clone(), Arc::new(parameters)),
                            (
                                train,
                                PathfindingTrain {
                                    consist: pathfinding_consist,
                                    constraints: path_constraints,
                                },
                            ),
                        )
                    },
                )
                .multiunzip();
        self.pathfinding_env.extend(pathfinding_trains);
        self.inputs.consists.extend(simulation_consists);
        self.inputs.parameters.extend(simulation_params);
    }
}
