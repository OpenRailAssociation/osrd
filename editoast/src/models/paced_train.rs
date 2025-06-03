use chrono::DateTime;
use chrono::Duration as ChronoDuration;
use chrono::Utc;
use editoast_derive::Model;
use editoast_models::rolling_stock::TrainCategory;
use editoast_schemas;
use editoast_schemas::paced_train;
use editoast_schemas::paced_train::Paced;
use editoast_schemas::paced_train::PacedTrainException;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleOptions;

use super::Tags;
use crate::models::prelude::*;
use crate::models::train_schedule::TrainSchedule;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
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
    /// Time window of the paced train
    pub time_window: ChronoDuration,
    /// Time between two occurrences
    pub interval: ChronoDuration,
    pub category: Option<TrainCategory>,
    #[model(json)]
    pub exceptions: Vec<PacedTrainException>,
}

impl PacedTrain {
    pub fn apply_exceptions(&self, exceptions: &[PacedTrainException]) -> Vec<TrainSchedule> {
        exceptions
            .iter()
            .map(|exception| self.apply_exception(exception))
            .collect()
    }

    pub fn apply_exception(&self, exception: &PacedTrainException) -> TrainSchedule {
        let mut train_schedule = self.clone().into_train_schedule();

        if let Some(change_group) = &exception.train_name {
            train_schedule.train_name = change_group.value.clone();
        }
        if let Some(change_group) = &exception.rolling_stock {
            train_schedule.comfort = change_group.comfort;
            train_schedule.rolling_stock_name = change_group.rolling_stock_name.clone();
        }
        if let Some(change_group) = &exception.rolling_stock_category {
            train_schedule.category = change_group.value.clone().map(TrainCategory);
        }
        if let Some(change_group) = &exception.labels {
            train_schedule.labels = change_group.value.iter().cloned().map(Some).collect();
        }
        if let Some(change_group) = &exception.speed_limit_tag {
            train_schedule.speed_limit_tag = change_group.value.clone().map(|value| value.0);
        }
        if let Some(change_group) = &exception.start_time {
            train_schedule.start_time = change_group.value
        }
        if let Some(change_group) = &exception.constraint_distribution {
            train_schedule.constraint_distribution = change_group.value;
        }
        if let Some(change_group) = &exception.initial_speed {
            train_schedule.initial_speed = change_group.value;
        }
        if let Some(change_group) = &exception.options {
            train_schedule.options = change_group.value.clone();
        }
        if let Some(change_group) = &exception.path_and_schedule {
            train_schedule.margins = change_group.margins.clone();
            train_schedule.path = change_group.path.clone();
            train_schedule.power_restrictions = change_group.power_restrictions.clone();
            train_schedule.schedule = change_group.schedule.clone();
        }

        train_schedule
    }

    pub fn into_train_schedule(self) -> TrainSchedule {
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
            category: self.category,
        }
    }

    pub fn iter_occurrences(&self) -> impl Iterator<Item = TrainSchedule> {
        let base_occurrence = self.clone().into_train_schedule();

        (0..self.num_occurrences()).map(move |occurrence_idx| TrainSchedule {
            start_time: base_occurrence.start_time + self.interval * occurrence_idx as i32,
            ..base_occurrence.clone()
        })
    }

    pub fn num_occurrences(&self) -> usize {
        (self.time_window.num_seconds() / self.interval.num_seconds()) as usize
    }
}

impl From<paced_train::PacedTrain> for PacedTrainChangeset {
    fn from(
        paced_train::PacedTrain {
            train_schedule_base,
            paced,
            exceptions,
        }: paced_train::PacedTrain,
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
            .time_window(ChronoDuration::from(paced.time_window))
            .interval(ChronoDuration::from(paced.interval))
            .category(train_schedule_base.category.map(TrainCategory))
            .exceptions(exceptions)
    }
}

impl From<PacedTrain> for paced_train::PacedTrain {
    fn from(paced_train: PacedTrain) -> Self {
        Self {
            train_schedule_base: editoast_schemas::TrainSchedule {
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
                category: paced_train.category.as_deref().cloned(),
            },
            exceptions: paced_train.exceptions,
            paced: Paced {
                time_window: paced_train.time_window.try_into().unwrap(),
                interval: paced_train.interval.try_into().unwrap(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use chrono::DateTime;
    use chrono::Utc;
    use editoast_models::rolling_stock::TrainCategory;
    use editoast_schemas::paced_train::PacedTrainException;
    use editoast_schemas::train_schedule::Comfort;
    use editoast_schemas::train_schedule::Distribution;
    use editoast_schemas::train_schedule::Margins;
    use editoast_schemas::train_schedule::TrainScheduleOptions;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use crate::models::PacedTrain;
    use crate::models::Tags;
    use crate::models::fixtures::create_created_exception_with_change_groups;
    use crate::models::fixtures::create_modified_exception_with_change_groups;

    pub fn create_paced_train(exceptions: Vec<PacedTrainException>) -> PacedTrain {
        PacedTrain {
            id: 1,
            timetable_id: 1,
            train_name: "train_name".to_string(),
            rolling_stock_name: "R2D2".to_string(),
            comfort: Comfort::Standard,
            initial_speed: 25.0,
            category: Some(TrainCategory(
                editoast_schemas::rolling_stock::TrainCategory::HighSpeedTrain,
            )),
            constraint_distribution: Distribution::Standard,
            labels: Tags::new(vec![]),
            margins: Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            },
            path: vec![],
            power_restrictions: vec![],
            schedule: vec![],
            speed_limit_tag: None,
            options: TrainScheduleOptions::default(),
            start_time: DateTime::<Utc>::from_str("2024-09-17T20:05:00+02:00").unwrap(),
            time_window: chrono::Duration::try_hours(2).unwrap(),
            interval: chrono::Duration::try_minutes(30).unwrap(),
            exceptions,
        }
    }

    #[rstest]
    #[case::created(create_created_exception_with_change_groups("key_1"))]
    #[case::modified(create_modified_exception_with_change_groups("key_2", 0))]
    async fn paced_train_apply_exception(#[case] exception: PacedTrainException) {
        let paced_train = create_paced_train(vec![exception.clone()]);
        let paced_train_exception = paced_train.apply_exception(&exception);

        assert_eq!(
            paced_train_exception.train_name,
            exception.train_name.unwrap().value
        );
        assert_eq!(
            paced_train_exception.rolling_stock_name,
            exception.rolling_stock.clone().unwrap().rolling_stock_name
        );
        assert_eq!(
            paced_train_exception.comfort,
            exception.rolling_stock.unwrap().comfort
        );
        assert_eq!(
            paced_train_exception.initial_speed,
            exception.initial_speed.unwrap().value
        );
        assert_eq!(
            paced_train_exception.category,
            exception
                .rolling_stock_category
                .unwrap()
                .value
                .map(TrainCategory)
        );
        assert_eq!(
            paced_train_exception.constraint_distribution,
            exception.constraint_distribution.unwrap().value
        );
        assert_eq!(
            paced_train_exception.labels,
            exception
                .labels
                .unwrap()
                .value
                .into_iter()
                .map(Some)
                .collect::<Vec<Option<String>>>()
        );
        assert_eq!(
            paced_train_exception.margins,
            exception.path_and_schedule.clone().unwrap().margins
        );
        assert_eq!(
            paced_train_exception.path,
            exception.path_and_schedule.clone().unwrap().path
        );
        assert_eq!(
            paced_train_exception.power_restrictions,
            exception
                .path_and_schedule
                .clone()
                .unwrap()
                .power_restrictions
        );
        assert_eq!(
            paced_train_exception.schedule,
            exception.path_and_schedule.clone().unwrap().schedule
        );
        assert_eq!(
            paced_train_exception.speed_limit_tag,
            exception
                .speed_limit_tag
                .unwrap()
                .value
                .map(|v| v.to_string())
        );
        assert_eq!(
            paced_train_exception.options,
            exception.options.unwrap().value
        );
    }
}
