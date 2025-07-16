use std::collections::HashMap;

use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use editoast_models::rolling_stock::TrainMainCategory;
use editoast_schemas;
use editoast_schemas::rolling_stock::TrainCategory;
use editoast_schemas::train_schedule;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleLike;
use editoast_schemas::train_schedule::TrainScheduleOptions;

use crate::models::prelude::*;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default))]
#[model(table = editoast_models::tables::train_schedule)]
#[model(gen(ops = crud, batch_ops = crd, list))]
#[model(row(derive(diesel::QueryableByName)))]
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
    pub main_category: Option<TrainMainCategory>,
}

impl From<editoast_schemas::TrainSchedule> for TrainScheduleChangeset {
    fn from(
        editoast_schemas::TrainSchedule {
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
            category,
        }: editoast_schemas::TrainSchedule,
    ) -> Self {
        let main_category = match category {
            Some(TrainCategory::Main { main_category }) => Some(TrainMainCategory(main_category)),
            _ => None,
        };
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
            .main_category(main_category)
    }
}

impl TrainScheduleLike for TrainSchedule {
    fn rolling_stock_name(&self) -> &str {
        &self.rolling_stock_name
    }

    fn start_time(&self) -> DateTime<Utc> {
        self.start_time
    }

    fn path(&self) -> &[PathItem] {
        &self.path
    }

    fn schedule(&self) -> &[ScheduleItem] {
        &self.schedule
    }

    fn margins(&self) -> &Margins {
        &self.margins
    }

    fn initial_speed(&self) -> f64 {
        self.initial_speed
    }

    fn comfort(&self) -> Comfort {
        self.comfort
    }

    fn constraint_distribution(&self) -> Distribution {
        self.constraint_distribution
    }

    fn speed_limit_tag(&self) -> Option<&String> {
        self.speed_limit_tag.as_ref()
    }

    fn power_restrictions(&self) -> &[PowerRestrictionItem] {
        &self.power_restrictions
    }

    fn options(&self) -> &TrainScheduleOptions {
        &self.options
    }
}

impl From<TrainSchedule> for train_schedule::TrainSchedule {
    fn from(train_schedule: TrainSchedule) -> Self {
        Self {
            train_name: train_schedule.train_name,
            labels: train_schedule.labels.into_iter().flatten().collect(),
            rolling_stock_name: train_schedule.rolling_stock_name,
            start_time: train_schedule.start_time,
            schedule: train_schedule.schedule,
            margins: train_schedule.margins,
            initial_speed: train_schedule.initial_speed,
            comfort: train_schedule.comfort,
            path: train_schedule.path,
            constraint_distribution: train_schedule.constraint_distribution,
            speed_limit_tag: train_schedule.speed_limit_tag.map(Into::into),
            power_restrictions: train_schedule.power_restrictions,
            options: train_schedule.options,
            category: train_schedule
                .main_category
                .as_deref()
                .copied()
                .map(TrainCategory::from), // TODO: or sub category when it's going to exist
        }
    }
}

impl TrainSchedule {
    // TODO: maybe find a better name
    pub fn iter_stops(&self) -> impl Iterator<Item = &PathItem> {
        let scheduled_items = self
            .schedule
            .iter()
            .map(|item| (item.at.as_ref(), item))
            .collect::<HashMap<_, _>>();
        let n = self.path.len();
        self.path
            .iter()
            .enumerate()
            .filter_map(move |(i, path_item)| {
                if i == 0 // the beginning of the path
                    || i == n - 1 // the end of the path
                    || scheduled_items // a scheduled stop
                        .get(path_item.id.as_str())
                        .is_some_and(|item| {
                            item.stop_for
                                .as_ref()
                                .is_some_and(|duration| !duration.is_zero())
                        })
                {
                    Some(path_item)
                } else {
                    None
                }
            })
    }
}
