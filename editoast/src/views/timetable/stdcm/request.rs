use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use common::units;
use core_client::pathfinding::PathfindingInputError;
use database::DbConnection;

use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::RollingStock;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::Serializer;
use units::quantities;
use uom::si::length::meter;
use uom::si::mass::kilogram;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::pathfinding::PathfindingFailure;
use crate::views::path::pathfinding::PathfindingResult;
use editoast_models::TemporarySpeedLimit;
use editoast_models::TowedRollingStock;
use editoast_models::WorkSchedule;
use editoast_models::prelude::*;

use super::StdcmError;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub(crate) struct PathfindingItem {
    /// The stop duration in milliseconds, None if the train does not stop.
    pub(crate) duration: Option<u64>,
    /// The associated location
    pub(crate) location: PathItemLocation,
    /// Time at which the train should arrive at the location, if specified
    #[schema(inline)]
    pub(crate) timing_data: Option<StepTimingData>,
}

/// Convert the list of pathfinding items into a list of path item
pub(super) fn convert_steps(steps: &[PathfindingItem]) -> Vec<PathItem> {
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
pub(crate) struct StepTimingData {
    /// Time at which the train should arrive at the location
    pub(crate) arrival_time: DateTime<Utc>,
    /// The train may arrive up to this duration before the expected arrival time
    pub(crate) arrival_time_tolerance_before: u64,
    /// The train may arrive up to this duration after the expected arrival time
    pub(crate) arrival_time_tolerance_after: u64,
}

/// An STDCM request
#[editoast_derive::annotate_units]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(remote = "Self")]
pub(crate) struct Request {
    /// Deprecated, first step arrival time should be used instead
    pub(crate) start_time: Option<DateTime<Utc>>,
    pub(crate) steps: Vec<PathfindingItem>,
    pub(crate) rolling_stock_id: i64,
    pub(crate) towed_rolling_stock_id: Option<i64>,
    pub(crate) electrical_profile_set_id: Option<i64>,
    pub(crate) work_schedule_group_id: Option<i64>,
    pub(crate) temporary_speed_limit_group_id: Option<i64>,
    pub(crate) comfort: Comfort,
    /// By how long we can shift the departure time in milliseconds
    /// Deprecated, first step data should be used instead
    pub(crate) maximum_departure_delay: Option<u64>,
    /// Specifies how long the total run time can be in milliseconds
    /// Deprecated, first step data should be used instead
    pub(crate) maximum_run_time: Option<u64>,
    /// Train categories for speed limits
    // TODO: rename the field and its description
    pub(crate) speed_limit_tags: Option<String>,
    /// Margin before the train passage in seconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds before its passage.
    #[serde(default)]
    pub(crate) time_gap_before: u64,
    /// Margin after the train passage in milliseconds
    ///
    /// Enforces that the path used by the train should be free and
    /// available at least that many milliseconds after its passage.
    #[serde(default)]
    pub(crate) time_gap_after: u64,
    /// Can be a percentage `X%`, a time in minutes per 100 kilometer `Xmin/100km`
    #[serde(default)]
    #[schema(value_type = Option<String>, example = json!(["5%", "2min/100km"]))]
    pub(crate) margin: Option<MarginValue>,
    /// Total mass of the consist
    #[serde(default, with = "units::kilogram::option")]
    pub(crate) total_mass: Option<quantities::Mass>,
    /// Total length of the consist in meters
    #[serde(default, with = "units::meter::option")]
    pub(crate) total_length: Option<quantities::Length>,
    /// Maximum speed of the consist in km/h
    #[serde(default, with = "units::meter_per_second::option")]
    pub(crate) max_speed: Option<quantities::Velocity>,
    pub(crate) loading_gauge_type: Option<LoadingGaugeType>,
}

impl Request {
    /// Returns the earliest time that has been set on any step
    pub(super) fn get_earliest_step_time(&self) -> DateTime<Utc> {
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
    pub(super) fn get_maximum_departure_delay(&self, simulation_run_time: u64) -> u64 {
        self.maximum_departure_delay
            .unwrap_or(simulation_run_time + self.get_earliest_step_tolerance_window())
    }

    // Maximum duration between train departure and arrival, including all stops
    pub(super) fn get_maximum_run_time(&self, simulation_run_time: u64) -> u64 {
        let constant_margin = 3_600_000; // 1h
        let fastest_run_time_multiplier = 1.4;

        let stop_time = self.get_total_stop_time();
        let scaled_run_time = (fastest_run_time_multiplier * simulation_run_time as f64) as u64;

        self.maximum_run_time
            .unwrap_or(stop_time + constant_margin + scaled_run_time)
    }

    /// Returns the earliest time at which the train may start
    pub(super) fn get_earliest_departure_time(&self, simulation_run_time: u64) -> DateTime<Utc> {
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

    pub(super) fn get_latest_simulation_end(&self, simulation_run_time: u64) -> DateTime<Utc> {
        self.get_earliest_departure_time(simulation_run_time)
            + Duration::milliseconds(
                (self.get_maximum_run_time(simulation_run_time)
                    + self.get_earliest_step_tolerance_window()) as i64,
            )
    }

    /// Return the list of speed limits that are active at any point in a given time range
    pub(super) async fn get_temporary_speed_limits(
        &self,
        conn: &mut DbConnection,
        simulation_run_time: u64,
    ) -> Result<Vec<core_client::stdcm::TemporarySpeedLimit>> {
        let start_date_time = self.get_earliest_departure_time(simulation_run_time);
        let end_date_time = self.get_latest_simulation_end(simulation_run_time);
        if end_date_time <= start_date_time || self.temporary_speed_limit_group_id.is_none() {
            return Ok(Vec::new());
        }
        let temporary_speed_limit_group_id = self.temporary_speed_limit_group_id.unwrap();
        let selection_settings: SelectionSettings<TemporarySpeedLimit> = SelectionSettings::new()
            .filter(move || {
                TemporarySpeedLimit::TEMPORARY_SPEED_LIMIT_GROUP_ID
                    .eq(temporary_speed_limit_group_id)
            });
        let applicable_speed_limits = TemporarySpeedLimit::list(conn, selection_settings)
            .await?
            .into_iter()
            .filter(|speed_limit| {
                !(end_date_time <= speed_limit.start_date_time
                    || speed_limit.end_date_time <= start_date_time)
            })
            .map(into_core_temporary_speed_limit)
            .collect();
        Ok(applicable_speed_limits)
    }

    pub(super) async fn get_stdcm_path_items(
        &self,
        conn: &mut DbConnection,
        infra_id: i64,
    ) -> Result<Vec<core_client::stdcm::PathItem>> {
        let locations: Vec<_> = self.steps.iter().map(|item| &item.location).collect();

        let path_item_cache = PathItemCache::load(conn, infra_id, &locations).await?;
        let track_offsets = path_item_cache
            .extract_location_from_path_items(&locations)
            .map_err(|path_res| match path_res {
                PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::InvalidPathItems { items },
                )) => StdcmError::InvalidPathItems { items },
                _ => panic!("Unexpected pathfinding result"),
            })?;

        Ok(track_offsets
            .iter()
            .zip(&self.steps)
            .map(|(track_offset, path_item)| core_client::stdcm::PathItem {
                stop_duration: path_item.duration,
                locations: track_offset.to_vec(),
                step_timing_data: path_item.timing_data.as_ref().map(|timing_data| {
                    core_client::stdcm::StepTimingData {
                        arrival_time: timing_data.arrival_time,
                        arrival_time_tolerance_before: timing_data.arrival_time_tolerance_before,
                        arrival_time_tolerance_after: timing_data.arrival_time_tolerance_after,
                    }
                }),
            })
            .collect())
    }

    /// Retrieves a list of work schedules, sorted by `start_date_time`.
    ///  It is expected that the list returned by this function will always be ordered by the `start_date_time` field.
    /// Any changes to the ordering behavior in the future should take this assumption into account.
    pub(super) async fn get_work_schedules(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Vec<WorkSchedule>, <WorkSchedule as List>::Error> {
        if self.work_schedule_group_id.is_none() {
            return Ok(vec![]);
        }

        let work_schedule_group_id = self.work_schedule_group_id.unwrap();
        let selection_setting = SelectionSettings::new()
            .order_by(|| WorkSchedule::START_DATE_TIME.asc())
            .filter(move || WorkSchedule::WORK_SCHEDULE_GROUP_ID.eq(work_schedule_group_id));
        WorkSchedule::list(conn, selection_setting).await
    }

    pub(super) async fn get_towed_rolling_stock(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Option<TowedRollingStock>> {
        if self.towed_rolling_stock_id.is_none() {
            return Ok(None);
        }

        let towed_rolling_stock_id = self.towed_rolling_stock_id.unwrap();
        let towed_rolling_stock =
            TowedRollingStock::retrieve_or_fail(conn.clone(), towed_rolling_stock_id, || {
                StdcmError::TowedRollingStockNotFound {
                    towed_rolling_stock_id,
                }
            })
            .await?;
        Ok(Some(towed_rolling_stock))
    }

    pub(super) fn validate_consist(
        &self,
        traction_engine: &RollingStock,
        towed_rolling_stock: &Option<schemas::TowedRollingStock>,
    ) -> Result<()> {
        self.validate_consist_mass(traction_engine, towed_rolling_stock)?;
        self.validate_consist_length(traction_engine, towed_rolling_stock)?;
        Ok(())
    }

    fn validate_consist_mass(
        &self,
        traction_engine: &RollingStock,
        towed_rolling_stock: &Option<schemas::TowedRollingStock>,
    ) -> Result<()> {
        let consist_mass = traction_engine.mass
            + towed_rolling_stock
                .as_ref()
                .map(|t| t.mass)
                .unwrap_or_default();
        let consist_mass = consist_mass.floor::<kilogram>();

        if let Some(request_total_mass) = self.total_mass
            && request_total_mass < consist_mass
        {
            return Err(StdcmError::InvalidConsistMass {
                expected_min: consist_mass.value,
                provided_consist_mass: request_total_mass.value,
            }
            .into());
        }

        Ok(())
    }

    fn validate_consist_length(
        &self,
        traction_engine: &RollingStock,
        towed_rolling_stock: &Option<schemas::TowedRollingStock>,
    ) -> Result<()> {
        let consist_length = traction_engine.length
            + towed_rolling_stock
                .as_ref()
                .map(|t| t.length)
                .unwrap_or_default();
        let consist_length = consist_length.floor::<meter>();

        if let Some(request_total_length) = self.total_length
            && request_total_length < consist_length
        {
            return Err(StdcmError::InvalidConsistLength {
                expected_min: consist_length.value,
                provided_consist_length: request_total_length.value,
            }
            .into());
        }

        Ok(())
    }
}

impl<'de> Deserialize<'de> for Request {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let request = Request::deserialize(deserializer)?;
        if let Some(mass) = request.total_mass
            && mass <= units::kilogram::new(0.0)
        {
            return Err(serde::de::Error::custom(
                "the total mass must be strictly positive",
            ));
        }

        if let Some(total_length) = request.total_length
            && total_length <= units::meter::new(0.0)
        {
            return Err(serde::de::Error::custom(
                "the length mass must be strictly positive",
            ));
        }

        if let Some(max_speed) = request.max_speed
            && max_speed <= units::meter_per_second::new(0.0)
        {
            return Err(serde::de::Error::custom(
                "the max_speed must be strictly positive",
            ));
        }

        Ok(request)
    }
}

impl Serialize for Request {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        Request::serialize(self, serializer)
    }
}

pub fn into_core_temporary_speed_limit(
    TemporarySpeedLimit {
        speed_limit,
        track_ranges,
        ..
    }: TemporarySpeedLimit,
) -> core_client::stdcm::TemporarySpeedLimit {
    core_client::stdcm::TemporarySpeedLimit {
        speed_limit,
        track_ranges: track_ranges
            .into_iter()
            .map(|track_range| track_range.into())
            .collect(),
    }
}
