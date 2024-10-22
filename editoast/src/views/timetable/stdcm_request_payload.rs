use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::simulation::SimulationParameters;

editoast_common::schemas! {
    STDCMRequestPayload,
    PathfindingItem,
    StepTimingData,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct PathfindingItem {
    /// The stop duration in milliseconds, None if the train does not stop.
    pub duration: Option<u64>,
    /// The associated location
    pub location: PathItemLocation,
    /// Time at which the train should arrive at the location, if specified
    pub timing_data: Option<StepTimingData>,
}

/// Convert the list of pathfinding items into a list of path item
pub fn convert_steps(steps: &[PathfindingItem]) -> Vec<PathItem> {
    steps
        .iter()
        .map(|step| PathItem {
            id: Default::default(),
            deleted: false,
            location: step.location.clone(),
        })
        .collect()
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StepTimingData {
    /// Time at which the train should arrive at the location
    pub arrival_time: DateTime<Utc>,
    /// The train may arrive up to this duration before the expected arrival time
    pub arrival_time_tolerance_before: u64,
    /// The train may arrive up to this duration after the expected arrival time
    pub arrival_time_tolerance_after: u64,
}

/// An STDCM request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct STDCMRequestPayload {
    /// Deprecated, first step arrival time should be used instead
    pub start_time: Option<DateTime<Utc>>,
    pub steps: Vec<PathfindingItem>,
    pub rolling_stock_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    pub work_schedule_group_id: Option<i64>,
    pub temporary_speed_limit_group_id: Option<i64>,
    pub comfort: Comfort,
    /// By how long we can shift the departure time in milliseconds
    /// Deprecated, first step data should be used instead
    pub maximum_departure_delay: Option<u64>,
    /// Specifies how long the total run time can be in milliseconds
    /// Deprecated, first step data should be used instead
    pub maximum_run_time: Option<u64>,
    /// Train categories for speed limits
    // TODO: rename the field and its description
    pub speed_limit_tags: Option<String>,
    /// Margin before the train passage in seconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds before its passage.
    #[serde(default)]
    pub time_gap_before: u64,
    /// Margin after the train passage in milliseconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds after its passage.
    #[serde(default)]
    pub time_gap_after: u64,
    /// Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km`
    #[serde(default)]
    #[schema(value_type = Option<String>, example = json!(["5%", "2min/100km"]))]
    pub margin: Option<MarginValue>,
    /// Total mass of the consist in kg
    pub total_mass: Option<f64>,
    /// Total length of the consist in meters
    pub total_length: Option<f64>,
    /// Maximum speed of the consist in km/h
    pub max_speed: Option<f64>,
}

impl STDCMRequestPayload {
    pub fn simulation_parameters(&self) -> SimulationParameters {
        SimulationParameters {
            total_mass: self.total_mass,
            total_length: self.total_length,
            max_speed: self.max_speed,
        }
    }

    /// Returns the earliest time that has been set on any step
    pub fn get_earliest_step_time(&self) -> DateTime<Utc> {
        // Get the earliest time that has been specified for any step
        self.start_time
            .or_else(|| {
                self.steps
                    .iter()
                    .flat_map(|step| step.timing_data.iter())
                    .map(|data| {
                        data.arrival_time
                            - Duration::milliseconds(data.arrival_time_tolerance_before as i64)
                    })
                    .next()
            })
            .expect("No time specified for stdcm request")
    }

    /// Returns the earliest tolerance window that has been set on any step
    fn get_earliest_step_tolerance_window(&self) -> u64 {
        // Get the earliest time window that has been specified for any step, if maximum_run_time is not none
        self.steps
            .iter()
            .flat_map(|step| step.timing_data.iter())
            .map(|data| data.arrival_time_tolerance_before + data.arrival_time_tolerance_after)
            .next()
            .unwrap_or(0)
    }

    /// Returns the request's total stop time
    fn get_total_stop_time(&self) -> u64 {
        self.steps
            .iter()
            .map(|step: &PathfindingItem| step.duration.unwrap_or_default())
            .sum()
    }

    // Returns the maximum departure delay for the train.
    pub fn get_maximum_departure_delay(&self, simulation_run_time: u64) -> u64 {
        self.maximum_departure_delay
            .unwrap_or(simulation_run_time + self.get_earliest_step_tolerance_window())
    }
    // Maximum duration between train departure and arrival, including all stops
    pub fn get_maximum_run_time(&self, simulation_run_time: u64) -> u64 {
        self.maximum_run_time
            .unwrap_or(2 * simulation_run_time + self.get_total_stop_time())
    }

    /// Returns the earliest time at which the train may start
    pub fn get_earliest_departure_time(&self, simulation_run_time: u64) -> DateTime<Utc> {
        // Prioritize: start time, or first step time, or (first specified time - max run time)
        self.start_time.unwrap_or(
            self.steps
                .first()
                .and_then(|step| step.timing_data.clone())
                .and_then(|data| {
                    Option::from(
                        data.arrival_time
                            - Duration::milliseconds(data.arrival_time_tolerance_before as i64),
                    )
                })
                .unwrap_or(
                    self.get_earliest_step_time()
                        - Duration::milliseconds(
                            self.get_maximum_run_time(simulation_run_time) as i64
                        ),
                ),
        )
    }

    pub fn get_latest_simulation_end(&self, simulation_run_time: u64) -> DateTime<Utc> {
        self.get_earliest_departure_time(simulation_run_time)
            + Duration::milliseconds(
                (self.get_maximum_run_time(simulation_run_time)
                    + self.get_earliest_step_tolerance_window()) as i64,
            )
    }
}
