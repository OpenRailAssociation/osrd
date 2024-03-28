use chrono::DateTime;
use chrono::Utc;
use editoast_derive::ModelV2;

use crate::schema::v2::trainschedule::Comfort;
use crate::schema::v2::trainschedule::Distribution;
use crate::schema::v2::trainschedule::Margins;
use crate::schema::v2::trainschedule::PathItem;
use crate::schema::v2::trainschedule::PowerRestrictionItem;
use crate::schema::v2::trainschedule::ScheduleItem;
use crate::schema::v2::trainschedule::TrainScheduleOptions;

#[derive(Debug, Default, Clone, ModelV2)]
#[model(table = crate::tables::train_schedule_v2)]
pub struct TrainSchedule {
    pub id: i64,
    pub train_name: String,
    pub labels: Vec<Option<String>>,
    pub rolling_stock_name: String,
    pub timetable_id: i64,
    pub start_time: DateTime<Utc>,
    #[model(json)]
    pub schedule: Vec<ScheduleItem>,
    #[model(json)]
    pub margins: Margins,
    pub initial_speed: f64,
    #[model(to_enum)]
    pub comfort: Comfort,
    #[model(json)]
    pub path: Vec<PathItem>,
    #[model(to_enum)]
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    #[model(json)]
    pub power_restrictions: Vec<PowerRestrictionItem>,
    #[model(json)]
    pub options: TrainScheduleOptions,
}
