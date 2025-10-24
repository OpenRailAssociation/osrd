use std::fmt::Display;
use std::str::FromStr;

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
use schemas::train_schedule::TrainSchedule;
use schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
#[model(table = database::tables::paced_train)]
#[model(gen(ops = crud, batch_ops = crud, list))]
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
    pub main_category: Option<TrainMainCategory>,
    /// Sub category code
    pub sub_category: Option<String>,
    #[model(json)]
    pub exceptions: Vec<PacedTrainException>,
}

impl PacedTrain {
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

    pub fn into_train_schedule(self) -> TrainSchedule {
        TrainSchedule {
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
    ) -> impl Iterator<Item = (OccurrenceId, TrainSchedule)> {
        self.exceptions
            .iter()
            .filter(|exception| matches!(exception.exception_type, ExceptionType::Created { .. }))
            .map(|exception| {
                (
                    OccurrenceId::CreatedException {
                        exception_key: exception.key.clone(),
                    },
                    self.apply_exception(exception),
                )
            })
    }

    fn get_occurrence_start_time(&self, occurrence_index: i32) -> DateTime<Utc> {
        self.start_time + self.interval * occurrence_index
    }

    /// Returns all base train occurrences without any exceptions applied.
    fn get_base_occurrences(&self) -> Vec<(OccurrenceId, TrainSchedule)> {
        (0..self.num_base_occurrences())
            .map(move |occurrence_idx| {
                let base_start_time = self.get_occurrence_start_time(occurrence_idx as i32);
                let train_id = OccurrenceId::BaseOccurrence {
                    index: occurrence_idx as u64,
                };
                let train_schedule = TrainSchedule {
                    start_time: base_start_time,
                    ..self.clone().into_train_schedule()
                };
                (train_id, train_schedule)
            })
            .collect()
    }

    /// Returns an iterator over all train occurrences, including:
    /// - base occurrences, minus the ones disabled by a modified exception
    /// - occurrences modified by exceptions (which replace a base one)
    /// - occurrences created by exceptions (additional trains)
    ///
    /// This function replaces any base occurrence that has a `Modified` exception,
    /// and appends any `Created` exceptions as new trains.
    ///
    /// The result is sorted by `start_time` to reflect the chronological order of the trains.
    pub fn iter_occurrences(&self) -> impl Iterator<Item = (OccurrenceId, TrainSchedule)> {
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
            if let Some(occurrence) = base_occurrences.get_mut(occurrence_index as usize) {
                if exception.disabled {
                    to_remove[occurrence_index as usize] = true;
                } else {
                    let occurrence_id = OccurrenceId::ModifiedException {
                        index: occurrence_index as u64,
                        exception_key: exception.key.clone(),
                    };
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

    /// Returns the number of base train occurrences within the pacing window.
    pub fn num_base_occurrences(&self) -> usize {
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
        let changeset = PacedTrain::changeset()
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
            .exceptions(exceptions);

        match train_schedule_base.category {
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

impl From<PacedTrain> for paced_train::PacedTrain {
    fn from(paced_train: PacedTrain) -> Self {
        Self {
            train_schedule_base: schemas::TrainSchedule {
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
                category: paced_train
                    .main_category
                    .map(|main_category| TrainCategory::main(main_category.0))
                    .xor(paced_train.sub_category.map(TrainCategory::sub)),
            },
            exceptions: paced_train.exceptions,
            paced: Paced {
                time_window: paced_train.time_window.try_into().unwrap(),
                interval: paced_train.interval.try_into().unwrap(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(tag = "type")]
pub enum OccurrenceId {
    BaseOccurrence { index: u64 },
    ModifiedException { index: u64, exception_key: String },
    CreatedException { exception_key: String },
}

#[derive(Debug, Clone, PartialEq)]
/// This ID is used to identify paced train occurrences and exceptions when sending them to the core API for conflict detection.
pub enum TrainId {
    TrainSchedule(i64),
    PacedTrain {
        paced_train_id: i64,
        occurrence_id: OccurrenceId,
    },
}

impl Display for TrainId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TrainSchedule(id) => write!(f, "{id}"),
            Self::PacedTrain {
                paced_train_id,
                occurrence_id: OccurrenceId::BaseOccurrence { index },
            } => write!(f, "{paced_train_id}#{index}"),
            Self::PacedTrain {
                paced_train_id,
                occurrence_id: OccurrenceId::CreatedException { exception_key },
            } => write!(f, "{paced_train_id}@{exception_key}"),
            Self::PacedTrain {
                paced_train_id,
                occurrence_id:
                    OccurrenceId::ModifiedException {
                        exception_key,
                        index,
                    },
            } => write!(f, "{paced_train_id}@{exception_key}#{index}"),
        }
    }
}

impl FromStr for TrainId {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Is it a paced train exception?
        if let Some((train_id_str, exception_str)) = s.split_once('@') {
            let paced_train_id = train_id_str
                .parse::<i64>()
                .map_err(|_| "Invalid train id")?;
            // Is it a modified paced train exception?
            if let Some((exception_key, index_str)) = exception_str.split_once('#') {
                let index = index_str
                    .parse::<u64>()
                    .map_err(|_| "Invalid exception index")?;
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id: OccurrenceId::ModifiedException {
                        exception_key: exception_key.to_string(),
                        index,
                    },
                })
            } else {
                let exception_key = exception_str.to_string();
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id: OccurrenceId::CreatedException { exception_key },
                })
            }
        } else {
            // Is it a base paced train exception?
            if let Some((train_id_str, index_str)) = s.split_once('#') {
                let paced_train_id = train_id_str
                    .parse::<i64>()
                    .map_err(|_| "Invalid train id")?;
                let index = index_str
                    .parse::<u64>()
                    .map_err(|_| "Invalid occurrence index")?;
                Ok(TrainId::PacedTrain {
                    paced_train_id,
                    occurrence_id: OccurrenceId::BaseOccurrence { index },
                })
            } else {
                let train_id = s.parse::<i64>().map_err(|_| "Invalid train id")?;
                Ok(TrainId::TrainSchedule(train_id))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use crate::models::PacedTrain;
    use crate::models::fixtures::create_created_exception_with_change_groups;
    use crate::models::fixtures::create_modified_exception_with_change_groups;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::paced_train::OccurrenceId;
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

    pub fn create_paced_train(exceptions: Vec<PacedTrainException>) -> PacedTrain {
        PacedTrain {
            id: 1,
            timetable_id: 1,
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
            time_window: chrono::Duration::try_hours(2).unwrap(),
            interval: chrono::Duration::try_minutes(30).unwrap(),
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
        let occurrences: Vec<(OccurrenceId, schemas::TrainSchedule)> =
            paced_train.iter_occurrences().collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<DateTime<Utc>> =
            occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<OccurrenceId> = occurrences.iter().map(|(t, _)| t.clone()).collect();

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
                OccurrenceId::ModifiedException {
                    index: 1,
                    exception_key: "key_1".to_string()
                },
                OccurrenceId::BaseOccurrence { index: 2 },
                OccurrenceId::CreatedException {
                    exception_key: "key_2".to_string()
                },
                OccurrenceId::BaseOccurrence { index: 3 },
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
        let occurrences: Vec<(OccurrenceId, schemas::TrainSchedule)> =
            paced_train.iter_occurrences().collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<DateTime<Utc>> =
            occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<OccurrenceId> = occurrences.iter().map(|(t, _)| t.clone()).collect();

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
                OccurrenceId::BaseOccurrence { index: 0 },
                OccurrenceId::ModifiedException {
                    index: 1,
                    exception_key: "key_1".to_string()
                },
                OccurrenceId::BaseOccurrence { index: 2 },
                OccurrenceId::BaseOccurrence { index: 3 },
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
