use chrono::DateTime;
use chrono::Duration as ChronoDuration;
use chrono::Utc;
use editoast_derive::Model;
use editoast_models::prelude::*;
use editoast_models::rolling_stock::TrainMainCategory;
use editoast_models::tags::Tags;
use itertools::Itertools;
use schemas;
use schemas::paced_train;
use schemas::paced_train::ExceptionType;
use schemas::paced_train::Paced;
use schemas::paced_train::PacedTrainException;
use schemas::rolling_stock::TrainCategory;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::Distribution;
use schemas::train_schedule::Margins;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PowerRestrictionItem;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainOccurrence;
use schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;
use std::fmt::Display;
use utoipa::ToSchema;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
#[model(table = database::tables::train_schedule)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct TrainSchedule {
    pub id: i64,
    pub train_name: String,
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
    pub rolling_stock_name: String,
    pub train_schedule_set_id: i64,
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
    pub time_window: Option<ChronoDuration>,
    /// Time between two occurrences
    pub interval: Option<ChronoDuration>,
    pub main_category: Option<TrainMainCategory>,
    /// Sub category code
    pub sub_category: Option<String>,
    #[model(json)]
    pub exceptions: Vec<PacedTrainException>,
}

impl TrainSchedule {
    pub fn apply_exception(&self, exception: &PacedTrainException) -> TrainOccurrence {
        let mut train_schedule = self.clone().into_train_occurrence();

        if let Some(change_group) = &exception.train_name {
            train_schedule.train_name = change_group.value.clone();
        }
        if let Some(change_group) = &exception.rolling_stock {
            train_schedule.comfort = change_group.comfort;
            train_schedule.rolling_stock_name = change_group.rolling_stock_name.clone();
        }
        if let Some(change_group) = &exception.rolling_stock_category {
            train_schedule.category = change_group.value.clone();
        }
        if let Some(change_group) = &exception.labels {
            train_schedule.labels = change_group.value.clone();
        }
        if let Some(change_group) = &exception.speed_limit_tag {
            train_schedule.speed_limit_tag = change_group.value.clone();
        }
        if let Some(change_group) = &exception.start_time {
            train_schedule.start_time = change_group.value
        }
        if let (ExceptionType::Modified { occurrence_index }, None) =
            (&exception.exception_type, &exception.start_time)
        {
            train_schedule.start_time = self.get_occurrence_start_time(*occurrence_index);
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

    pub fn into_train_occurrence(self) -> TrainOccurrence {
        TrainOccurrence {
            train_name: self.train_name,
            labels: self.labels.to_vec(),
            rolling_stock_name: self.rolling_stock_name,
            path: self.path,
            start_time: self.start_time,
            schedule: self.schedule,
            margins: self.margins,
            initial_speed: self.initial_speed,
            comfort: self.comfort,
            constraint_distribution: self.constraint_distribution,
            speed_limit_tag: self.speed_limit_tag.map(|s| s.into()),
            power_restrictions: self.power_restrictions,
            options: self.options,
            category: self
                .main_category
                .map(|main_category| TrainCategory::main(main_category.0))
                .xor(self.sub_category.map(TrainCategory::sub)),
        }
    }

    /// Returns an iterator over "created" train exceptions with their IDs and schedules.
    fn get_created_occurrences_exceptions(
        &self,
    ) -> impl Iterator<Item = (OccurrenceId, TrainOccurrence)> {
        self.exceptions
            .iter()
            .filter(|exception| matches!(exception.exception_type, ExceptionType::Created { .. }))
            .map(|exception| {
                (
                    OccurrenceId::new_created(self.id, exception.key.clone()),
                    self.apply_exception(exception),
                )
            })
    }

    /// Returns the start time of the occurrence at the given index.
    fn get_occurrence_start_time(&self, occurrence_index: usize) -> DateTime<Utc> {
        if let Some(interval) = self.interval {
            self.start_time + interval * occurrence_index as i32
        } else {
            self.start_time
        }
    }

    /// Returns all base train occurrences without any exceptions applied.
    /// If it's not a paced train, this will return a vector with a single train schedule.
    fn get_base_occurrences(&self) -> Vec<(OccurrenceId, TrainOccurrence)> {
        (0..self.num_base_occurrences())
            .map(move |occurrence_idx| {
                let base_start_time = self.get_occurrence_start_time(occurrence_idx);
                let occurrence = OccurrenceId::new_base(self.id, occurrence_idx);
                let train_schedule = TrainOccurrence {
                    start_time: base_start_time,
                    ..self.clone().into_train_occurrence()
                };
                (occurrence, train_schedule)
            })
            .collect()
    }

    /// Returns an iterator over all train occurrences, including:
    /// - base occurrences, minus the ones disabled by a modified exception
    /// - occurrences modified by exceptions (which replace a base one)
    /// - occurrences created by exceptions (additional trains)
    ///
    /// If it's not a paced train (i.e., no time window), this will return the single train schedule.
    ///
    /// This function replaces any base occurrence that has a `Modified` exception,
    /// and appends any `Created` exceptions as new trains.
    ///
    /// The result is sorted by `start_time` to reflect the chronological order of the trains.
    pub fn iter_occurrences(&self) -> impl Iterator<Item = (OccurrenceId, TrainOccurrence)> {
        let mut base_occurrences = self.get_base_occurrences();

        let modified_exceptions = self
            .exceptions
            .iter()
            .filter_map(|e| match e.exception_type {
                ExceptionType::Modified { occurrence_index } => Some((occurrence_index, e)),
                _ => None,
            });

        let mut to_remove = vec![false; base_occurrences.len()];
        // Modify corresponding occurrences.
        for (occurrence_index, exception) in modified_exceptions {
            if let Some(occurrence) = base_occurrences.get_mut(occurrence_index) {
                if exception.disabled {
                    to_remove[occurrence_index] = true;
                } else {
                    let occurrence_id = OccurrenceId::new_modified(
                        self.id,
                        occurrence_index,
                        exception.key.clone(),
                    );
                    *occurrence = (occurrence_id, self.apply_exception(exception));
                }
            }
        }
        // Remove disabled occurrences.
        let occurrences = base_occurrences
            .into_iter()
            .zip(to_remove)
            .filter_map(|(occ, disabled)| if disabled { None } else { Some(occ) });

        occurrences
            .into_iter()
            .chain(self.get_created_occurrences_exceptions())
            .sorted_by_key(|(_, ts)| ts.start_time)
    }

    /// Returns whether this train has paced occurrences.
    pub fn is_paced(&self) -> bool {
        self.time_window.is_some() && self.interval.is_some()
    }

    /// Returns the number of base train occurrences within the pacing window.
    /// Returns 1 if it's not a paced train.
    fn num_base_occurrences(&self) -> usize {
        if !self.is_paced() {
            return 1;
        }

        let time_window = self
            .time_window
            .expect("time_window should be set for paced trains");
        let interval = self
            .interval
            .expect("interval should be set for paced trains");
        (time_window.num_seconds() / interval.num_seconds()) as usize
    }
}

impl From<paced_train::TrainSchedule> for TrainScheduleChangeset {
    fn from(
        paced_train::TrainSchedule {
            train_occurrence,
            paced,
        }: paced_train::TrainSchedule,
    ) -> Self {
        let changeset = TrainSchedule::changeset()
            .comfort(train_occurrence.comfort)
            .constraint_distribution(train_occurrence.constraint_distribution)
            .initial_speed(train_occurrence.initial_speed)
            .labels(Tags::new(train_occurrence.labels))
            .margins(train_occurrence.margins)
            .path(train_occurrence.path)
            .power_restrictions(train_occurrence.power_restrictions)
            .rolling_stock_name(train_occurrence.rolling_stock_name)
            .schedule(train_occurrence.schedule)
            .speed_limit_tag(train_occurrence.speed_limit_tag.map(|s| s.0))
            .start_time(train_occurrence.start_time)
            .train_name(train_occurrence.train_name)
            .options(train_occurrence.options)
            .time_window(
                paced
                    .as_ref()
                    .map(|p| p.time_window)
                    .map(ChronoDuration::from),
            )
            .interval(paced.as_ref().map(|p| p.interval).map(ChronoDuration::from))
            .exceptions(paced.map(|p| p.exceptions).unwrap_or_default());

        match train_occurrence.category {
            Some(TrainCategory::Main { main_category }) => changeset
                .main_category(Some(TrainMainCategory(main_category)))
                .sub_category(None),
            Some(TrainCategory::Sub { sub_category_code }) => changeset
                .sub_category(Some(sub_category_code))
                .main_category(None),
            None => changeset.sub_category(None).main_category(None),
        }
    }
}

impl From<TrainSchedule> for paced_train::TrainSchedule {
    fn from(train_schedule: TrainSchedule) -> Self {
        Self {
            train_occurrence: schemas::TrainOccurrence {
                train_name: train_schedule.train_name,
                labels: train_schedule.labels.to_vec(),
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
                    .map(|main_category| TrainCategory::main(main_category.0))
                    .xor(train_schedule.sub_category.map(TrainCategory::sub)),
            },
            paced: train_schedule.time_window.and_then(|time_window| {
                train_schedule.interval.map(|interval| Paced {
                    time_window: time_window.try_into().unwrap(),
                    interval: interval.try_into().unwrap(),
                    exceptions: train_schedule.exceptions,
                })
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(tag = "type", rename_all = "snake_case")]
/// This ID is used to identify paced train occurrences and exceptions when sending them to the core API for conflict detection.
pub enum OccurrenceId {
    Base {
        train_schedule_id: i64,
        index: usize,
    },
    Modified {
        train_schedule_id: i64,
        index: usize,
        exception_key: String,
    },
    Created {
        train_schedule_id: i64,
        exception_key: String,
    },
}

impl OccurrenceId {
    /// Creates a new `Occurrence::Base`.
    pub fn new_base(id: i64, index: usize) -> Self {
        OccurrenceId::Base {
            train_schedule_id: id,
            index,
        }
    }

    /// Create a new `Occurrence::Modified` without an exception key.
    pub fn new_modified(id: i64, index: usize, exception_key: String) -> Self {
        OccurrenceId::Modified {
            train_schedule_id: id,
            index,
            exception_key,
        }
    }

    /// Creates a new `Occurrence::Created`.
    pub fn new_created(id: i64, exception_key: String) -> Self {
        OccurrenceId::Created {
            train_schedule_id: id,
            exception_key,
        }
    }
}

impl Display for OccurrenceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OccurrenceId::Base {
                train_schedule_id: id,
                index,
            } => write!(f, "{}#{}", id, index),
            OccurrenceId::Modified {
                train_schedule_id: id,
                index,
                exception_key,
            } => write!(f, "{}@{}#{}", id, exception_key, index),
            OccurrenceId::Created {
                train_schedule_id: id,
                exception_key,
            } => {
                write!(f, "{}@{}", id, exception_key)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use crate::models::TrainSchedule;
    use crate::models::fixtures::create_created_exception_with_change_groups;
    use crate::models::fixtures::create_modified_exception_with_change_groups;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::train_schedule::OccurrenceId;
    use chrono::DateTime;
    use chrono::Utc;
    use database::DbConnectionPoolV2;
    use editoast_models::prelude::*;
    use editoast_models::rolling_stock::TrainMainCategory;
    use editoast_models::tags::Tags;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::paced_train::PacedTrainException;
    use schemas::paced_train::RollingStockCategoryChangeGroup;
    use schemas::paced_train::StartTimeChangeGroup;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::Distribution;
    use schemas::train_schedule::Margins;
    use schemas::train_schedule::TrainScheduleOptions;

    pub fn create_paced_train(exceptions: Vec<PacedTrainException>) -> TrainSchedule {
        TrainSchedule {
            id: 1,
            train_schedule_set_id: 1,
            train_name: "train_name".to_string(),
            rolling_stock_name: "R2D2".to_string(),
            comfort: Comfort::Standard,
            initial_speed: 25.0,
            main_category: Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
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
            start_time: DateTime::<Utc>::from_str("2025-05-15T14:00:00+02:00").unwrap(),
            time_window: chrono::Duration::try_hours(2),
            interval: chrono::Duration::try_minutes(30),
            sub_category: None,
            exceptions,
        }
    }

    #[tokio::test]
    async fn paced_train_main_category_apply_exception() {
        let mut exception = create_created_exception_with_change_groups("key_1");

        exception.rolling_stock_category = Some(RollingStockCategoryChangeGroup {
            value: Some(schemas::rolling_stock::TrainCategory::Main {
                main_category: schemas::rolling_stock::TrainMainCategory::FastFreightTrain,
            }),
        });

        // The paced train has HighSpeedTrain
        let paced_train = create_paced_train(vec![exception.clone()]);
        let paced_train_exception = paced_train.apply_exception(&exception);

        // Check if it get replaced by exception category
        assert_eq!(
            paced_train_exception.category,
            Some(schemas::rolling_stock::TrainCategory::Main {
                main_category: schemas::rolling_stock::TrainMainCategory::FastFreightTrain
            })
        );
    }

    #[rstest]
    #[tokio::test]
    #[case::created(create_created_exception_with_change_groups("key_1"))]
    #[tokio::test]
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
        // Check if the category of the paced train that has a category is removed by an exception.
        assert_eq!(paced_train_exception.category, None);
        assert_eq!(
            paced_train_exception.constraint_distribution,
            exception.constraint_distribution.unwrap().value
        );
        assert_eq!(
            paced_train_exception.labels,
            exception.labels.unwrap().value
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
            exception.speed_limit_tag.unwrap().value
        );
        assert_eq!(
            paced_train_exception.options,
            exception.options.unwrap().value
        );
    }

    #[tokio::test]
    async fn num_base_occurrences_without_exceptions() {
        let paced_train = create_paced_train(vec![]);
        assert_eq!(paced_train.num_base_occurrences(), 4);
    }

    #[tokio::test]
    async fn num_base_occurrences_with_exceptions() {
        let paced_train = create_paced_train(vec![
            create_created_exception_with_change_groups("key_2"),
            create_modified_exception_with_change_groups("key_1", 0),
        ]);
        assert_eq!(paced_train.num_base_occurrences(), 4);
    }

    #[tokio::test]
    async fn iter_occurrences_with_exceptions() {
        let exception_1 = create_modified_exception_with_change_groups("key_1", 1);
        let exception_2 = create_created_exception_with_change_groups("key_2");
        let mut exception_3 = create_modified_exception_with_change_groups("key_3", 0);
        exception_3.disabled = true;

        let paced_train =
            create_paced_train(vec![exception_1.clone(), exception_2.clone(), exception_3]);
        let occurrences: Vec<_> = paced_train.iter_occurrences().collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<DateTime<Utc>> =
            occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<_> = occurrences.iter().map(|(t, _)| t.clone()).collect();

        assert_eq!(
            start_times,
            vec![
                DateTime::<Utc>::from_str("2025-05-15T14:30:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T15:00:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T15:10:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T15:30:00+02:00").unwrap(),
            ]
        );

        assert_eq!(
            train_names,
            vec![
                "modified_exception_train_name".to_string(),
                "train_name".to_string(),
                "created_exception_train_name".to_string(),
                "train_name".to_string(),
            ]
        );

        assert_eq!(
            types,
            vec![
                OccurrenceId::new_modified(paced_train.id, 1, "key_1".to_string()),
                OccurrenceId::new_base(paced_train.id, 2),
                OccurrenceId::new_created(paced_train.id, "key_2".to_string()),
                OccurrenceId::new_base(paced_train.id, 3),
            ]
        );
    }

    #[tokio::test]
    async fn iter_occurrences_with_modified_start_time_exception() {
        let mut exception_1 = create_modified_exception_with_change_groups("key_1", 1);
        exception_1.start_time = Some(StartTimeChangeGroup {
            value: DateTime::<Utc>::from_str("2025-05-15T14:31:00+02:00").unwrap(),
        });

        let paced_train = create_paced_train(vec![exception_1.clone()]);
        let occurrences: Vec<_> = paced_train.iter_occurrences().collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<DateTime<Utc>> =
            occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<_> = occurrences.iter().map(|(t, _)| t.clone()).collect();

        assert_eq!(
            start_times,
            vec![
                DateTime::<Utc>::from_str("2025-05-15T14:00:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T14:31:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T15:00:00+02:00").unwrap(),
                DateTime::<Utc>::from_str("2025-05-15T15:30:00+02:00").unwrap(),
            ]
        );

        assert_eq!(
            train_names,
            vec![
                "train_name".to_string(),
                "modified_exception_train_name".to_string(),
                "train_name".to_string(),
                "train_name".to_string(),
            ]
        );

        assert_eq!(
            types,
            vec![
                OccurrenceId::new_base(paced_train.id, 0),
                OccurrenceId::new_modified(paced_train.id, 1, "key_1".to_string()),
                OccurrenceId::new_base(paced_train.id, 2),
                OccurrenceId::new_base(paced_train.id, 3),
            ]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_both_categories_check_post() {
        let pool = DbConnectionPoolV2::for_tests();

        let timetable = create_timetable(&mut pool.get_ok()).await;
        let paced_train_changeset = simple_paced_train_changeset(timetable.id);
        let created_sub_category = simple_sub_category(
            "tjv",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let train_schedule_changeset = paced_train_changeset
            .sub_category(Some(created_sub_category.code))
            .main_category(Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
            )));
        let error = train_schedule_changeset
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();

        assert_eq!(
            error,
            editoast_models::Error::CheckViolation {
                constraint: "only_one_category".to_string(),
            }
        );
    }
}
