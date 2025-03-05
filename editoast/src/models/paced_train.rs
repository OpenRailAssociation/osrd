use chrono::DateTime;
use chrono::Duration as ChronoDuration;
use chrono::Utc;
use editoast_derive::Model;
use editoast_schemas::paced_train::Paced;
use editoast_schemas::paced_train::PacedTrainBase;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleBase;
use editoast_schemas::train_schedule::TrainScheduleOptions;

use super::Tags;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::paced_train)]
#[model(gen(ops = crud, batch_ops = crd, list))]
pub struct PacedTrain {
    pub id: i64,
    pub train_name: String,
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
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
    /// Total duration of the paced train
    pub duration: ChronoDuration,
    /// Time between two occurrences
    pub step: ChronoDuration,
}

impl PacedTrain {
    pub fn into_first_occurrence(self) -> TrainSchedule {
        TrainSchedule {
            id: self.id,
            train_name: self.train_name,
            labels: self.labels.into(),
            rolling_stock_name: self.rolling_stock_name,
            timetable_id: self.timetable_id,
            path: self.path,
            start_time: self.start_time,
            schedule: self.schedule,
            margins: self.margins,
            initial_speed: self.initial_speed,
            comfort: self.comfort,
            constraint_distribution: self.constraint_distribution,
            speed_limit_tag: self.speed_limit_tag,
            power_restrictions: self.power_restrictions,
            options: self.options,
        }
    }
}

impl From<PacedTrainBase> for PacedTrainChangeset {
    fn from(
        PacedTrainBase {
            train_schedule_base,
            paced,
        }: PacedTrainBase,
    ) -> Self {
        PacedTrain::changeset()
            .comfort(train_schedule_base.comfort)
            .constraint_distribution(train_schedule_base.constraint_distribution)
            .initial_speed(train_schedule_base.initial_speed)
            .labels(Tags::new(train_schedule_base.labels))
            .margins(train_schedule_base.margins)
            .path(train_schedule_base.path)
            .power_restrictions(train_schedule_base.power_restrictions)
            .rolling_stock_name(train_schedule_base.rolling_stock_name)
            .schedule(train_schedule_base.schedule)
            .speed_limit_tag(train_schedule_base.speed_limit_tag.map(|s| s.0))
            .start_time(train_schedule_base.start_time)
            .train_name(train_schedule_base.train_name)
            .options(train_schedule_base.options)
            .duration(ChronoDuration::from(paced.duration))
            .step(ChronoDuration::from(paced.step))
    }
}

impl From<PacedTrain> for PacedTrainBase {
    fn from(paced_train: PacedTrain) -> Self {
        Self {
            train_schedule_base: TrainScheduleBase {
                train_name: paced_train.train_name,
                labels: paced_train.labels.to_vec(),
                rolling_stock_name: paced_train.rolling_stock_name,
                start_time: paced_train.start_time,
                schedule: paced_train.schedule,
                margins: paced_train.margins,
                initial_speed: paced_train.initial_speed,
                comfort: paced_train.comfort,
                path: paced_train.path,
                constraint_distribution: paced_train.constraint_distribution,
                speed_limit_tag: paced_train.speed_limit_tag.map(Into::into),
                power_restrictions: paced_train.power_restrictions,
                options: paced_train.options,
            },
            paced: Paced {
                duration: paced_train.duration.try_into().unwrap(),
                step: paced_train.step.try_into().unwrap(),
            },
        }
    }
}
