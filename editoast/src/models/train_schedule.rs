use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleBase;
use editoast_schemas::train_schedule::TrainScheduleOptions;

use super::Model as _;

#[derive(Debug, Default, Clone, Model)]
#[model(table = editoast_models::tables::train_schedule)]
#[model(gen(ops = crud, batch_ops = crd, list))]
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

impl From<TrainScheduleBase> for TrainScheduleChangeset {
    fn from(
        TrainScheduleBase {
            train_name,
            labels,
            rolling_stock_name,
            start_time,
            path,
            schedule,
            margins,
            initial_speed,
            comfort,
            constraint_distribution,
            speed_limit_tag,
            power_restrictions,
            options,
        }: TrainScheduleBase,
    ) -> Self {
        TrainSchedule::changeset()
            .comfort(comfort)
            .constraint_distribution(constraint_distribution)
            .initial_speed(initial_speed)
            .labels(labels.into_iter().map(Some).collect())
            .margins(margins)
            .path(path)
            .power_restrictions(power_restrictions)
            .rolling_stock_name(rolling_stock_name)
            .schedule(schedule)
            .speed_limit_tag(speed_limit_tag.map(|s| s.0))
            .start_time(start_time)
            .train_name(train_name)
            .options(options)
    }
}
