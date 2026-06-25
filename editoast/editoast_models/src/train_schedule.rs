use crate::prelude::*;
use crate::rolling_stock::TrainMainCategory;
use crate::tags::Tags;
use chrono::Duration as ChronoDuration;
use common::units::millisecond;
use common::units::quantities::Offset;
use derive_more::Display;
use editoast_derive::Model;
use itertools::Itertools;
use schemas;
use schemas::TrainScheduleException;
use schemas::paced_train;
use schemas::paced_train::Paced;
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
#[cfg_attr(any(test, feature = "testing"), derive(Default, PartialEq))]
#[model(table = database::tables::train_schedule)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct TrainSchedule {
    pub id: i64,
    pub train_name: String,
    #[model(remote = "Vec<Option<String>>")]
    pub labels: Tags,
    pub rolling_stock_name: String,
    pub train_schedule_set_id: i64,
    #[model(uom_unit = "common::units::millisecond::i64")]
    /// For calendar timetables: elapsed ms since 1970-01-01T00:00:00Z.
    /// For hourly timetables: elapsed ms since the timetable start.
    pub start_time: Offset,
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
}

/// Transforms the TrainSchedule database type into a paced_train::TrainSchedule schema with exceptions.
pub fn train_schedule_schema_from_model(
    train_schedule: TrainSchedule,
    exceptions: Vec<TrainScheduleException>,
) -> paced_train::TrainSchedule {
    paced_train::TrainSchedule {
        train_occurrence: TrainOccurrence {
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
                exceptions,
            })
        }),
    }
}

impl TrainSchedule {
    pub fn is_exception_occurrence_index_valid(&self, occurrence_index: i64) -> bool {
        usize::try_from(occurrence_index)
            .is_ok_and(|i| (0..self.num_base_occurrences()).contains(&i))
    }

    pub fn apply_train_schedule_exception(
        &self,
        exception: &TrainScheduleException,
    ) -> TrainOccurrence {
        let mut train_occurrence = self.clone().into_train_occurrence();

        if let Some(change_group) = &exception.change_groups.train_name {
            train_occurrence.train_name = change_group.value.clone();
        }
        if let Some(change_group) = &exception.change_groups.rolling_stock {
            train_occurrence.comfort = change_group.comfort;
            train_occurrence.rolling_stock_name = change_group.rolling_stock_name.clone();
        }
        if let Some(change_group) = &exception.change_groups.rolling_stock_category {
            train_occurrence.category = change_group.value.clone();
        }
        if let Some(change_group) = &exception.change_groups.labels {
            train_occurrence.labels = change_group.value.clone();
        }
        if let Some(change_group) = &exception.change_groups.speed_limit_tag {
            train_occurrence.speed_limit_tag = change_group.value.clone();
        }
        if let Some(change_group) = &exception.change_groups.start_time {
            train_occurrence.start_time = change_group.value
        }
        if let (Some(occurrence_index), None) = (
            &exception.occurrence_index,
            &exception.change_groups.start_time,
        ) {
            train_occurrence.start_time =
                self.get_occurrence_start_time(*occurrence_index as usize);
        }
        if let Some(change_group) = &exception.change_groups.constraint_distribution {
            train_occurrence.constraint_distribution = change_group.value;
        }
        if let Some(change_group) = &exception.change_groups.initial_speed {
            train_occurrence.initial_speed = change_group.value;
        }
        if let Some(change_group) = &exception.change_groups.options {
            train_occurrence.options = change_group.value.clone();
        }
        if let Some(change_group) = &exception.change_groups.path_and_schedule {
            train_occurrence.margins = change_group.margins.clone();
            train_occurrence.path = change_group.path.clone();
            train_occurrence.power_restrictions = change_group.power_restrictions.clone();
            train_occurrence.schedule = change_group.schedule.clone();
        }

        train_occurrence
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

    /// Returns the start time of the occurrence at the given index.
    fn get_occurrence_start_time(&self, occurrence_index: usize) -> Offset {
        if let Some(interval) = self.interval {
            self.start_time
                + millisecond::i64::new((interval * occurrence_index as i32).num_milliseconds())
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

    /// Returns time window and interval when this train has paced occurrences.
    pub fn pace(&self) -> Option<(ChronoDuration, ChronoDuration)> {
        self.time_window.zip(self.interval)
    }

    /// Returns the number of base train occurrences within the pacing window.
    /// Returns 1 if it's not a paced train.
    fn num_base_occurrences(&self) -> usize {
        if let Some((time_window, interval)) = self.pace() {
            // Ideally, we’d use `div_ceil` which is nightly-only at the time of writing
            // https://doc.rust-lang.org/std/primitive.i64.html#method.div_ceil
            let time_window = time_window.num_seconds();
            let interval = interval.num_seconds();
            (time_window / interval) as usize
                + if time_window.rem_euclid(interval) != 0 {
                    1
                } else {
                    0
                }
        } else {
            1
        }
    }

    /// Returns an iterator over "created" train exceptions with their IDs and schedules.
    fn get_created_occurrences_exceptions(
        &self,
        exceptions: &[TrainScheduleException],
    ) -> impl Iterator<Item = (OccurrenceId, TrainOccurrence)> {
        exceptions
            .iter()
            .filter(|exception| exception.occurrence_index.is_none())
            .map(|exception| {
                (
                    OccurrenceId::new_created(self.id, exception.id),
                    self.apply_train_schedule_exception(exception),
                )
            })
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
    pub fn iter_occurrences(
        &self,
        exceptions: &[TrainScheduleException],
    ) -> impl Iterator<Item = (OccurrenceId, TrainOccurrence)> {
        let mut base_occurrences = self.get_base_occurrences();

        let modified_exceptions = exceptions.iter().filter_map(|e| {
            e.occurrence_index
                .map(|occurrence_index| (occurrence_index, e))
        });

        let mut to_remove = vec![false; base_occurrences.len()];
        // Modify corresponding occurrences.
        for (occurrence_index, exception) in modified_exceptions {
            if let Some(occurrence) = base_occurrences.get_mut(occurrence_index as usize) {
                if exception.disabled {
                    to_remove[occurrence_index as usize] = true;
                } else {
                    let occurrence_id = OccurrenceId::new_modified(
                        self.id,
                        occurrence_index as usize,
                        exception.id,
                    );
                    *occurrence = (
                        occurrence_id,
                        self.apply_train_schedule_exception(exception),
                    );
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
            .chain(self.get_created_occurrences_exceptions(exceptions))
            .sorted_by_key(|(_, ts)| millisecond::i64::from(ts.start_time))
    }

    /// Returns an iterator over the base train and exceptions (disabled included)
    /// - base train
    /// - occurrences modified by exceptions
    /// - occurrences created by exceptions (additional trains)
    ///
    /// If it's not a paced train (i.e., no time window), this will return the single train schedule.
    ///
    /// Useful to have all occurrences that can have different simulations.
    /// IMPORTANT: Do not use this function to get all occurrences for conflict detection, as it includes disabled occurrences. Use `iter_occurrences` instead.
    pub fn iter_base_and_exceptions(
        &self,
        exceptions: &[TrainScheduleException],
    ) -> impl Iterator<Item = (BaseTrainOrOccurrenceId, TrainOccurrence)> {
        let mut results = vec![(
            BaseTrainOrOccurrenceId::Base(self.id),
            self.clone().into_train_occurrence(),
        )];

        let modified_exceptions = exceptions.iter().filter_map(|e| {
            e.occurrence_index
                .map(|occurrence_index| (occurrence_index, e))
        });

        // Modify corresponding occurrences.
        for (occurrence_index, exception) in modified_exceptions {
            let occurrence_id =
                OccurrenceId::new_modified(self.id, occurrence_index as usize, exception.id);
            results.push((
                BaseTrainOrOccurrenceId::Occurrence(occurrence_id),
                self.apply_train_schedule_exception(exception),
            ));
        }

        results
            .into_iter()
            .chain(self.get_created_occurrences_exceptions(exceptions).map(
                |(occurrence_id, train_occurrence)| {
                    (
                        BaseTrainOrOccurrenceId::Occurrence(occurrence_id),
                        train_occurrence,
                    )
                },
            ))
    }

    /// Determines whether the pace (time window and interval) of the train schedule is the same as the given pace.
    pub fn has_same_pace(&self, paced: Option<&Paced>) -> bool {
        self.interval == paced.as_ref().map(|p| p.interval.into())
            && self.time_window == paced.as_ref().map(|p| p.time_window.into())
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
            .interval(paced.as_ref().map(|p| p.interval).map(ChronoDuration::from));

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

#[derive(Debug, Clone, Display, PartialEq, Eq, Hash)]
pub enum BaseTrainOrOccurrenceId {
    Occurrence(OccurrenceId),
    Base(i64),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(tag = "type", rename_all = "snake_case")]
#[schema(title_variants)]
/// This ID is used to identify paced train occurrences and exceptions when sending them to the core API for conflict detection.
pub enum OccurrenceId {
    Base {
        train_schedule_id: i64,
        index: usize,
    },
    Modified {
        train_schedule_id: i64,
        index: usize,
        exception_id: i64,
    },
    Created {
        train_schedule_id: i64,
        exception_id: i64,
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
    pub fn new_modified(id: i64, index: usize, exception_id: i64) -> Self {
        OccurrenceId::Modified {
            train_schedule_id: id,
            index,
            exception_id,
        }
    }

    /// Creates a new `Occurrence::Created`.
    pub fn new_created(id: i64, exception_id: i64) -> Self {
        OccurrenceId::Created {
            train_schedule_id: id,
            exception_id,
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
                exception_id,
            } => write!(f, "{}@{}#{}", id, exception_id, index),
            OccurrenceId::Created {
                train_schedule_id: id,
                exception_id,
            } => write!(f, "{}@{}", id, exception_id),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::SubCategory;
    use crate::Tags;
    use crate::Timetable;
    use crate::TrainScheduleException;
    use crate::rolling_stock::TrainMainCategory;
    use crate::train_schedule::train_schedule_schema_from_model;

    use super::OccurrenceId;
    use super::TrainSchedule;
    use common::units::quantities::Offset;
    use database::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::fixtures::ms_since_epoch;
    use schemas::paced_train::RollingStockCategoryChangeGroup;
    use schemas::paced_train::StartTimeChangeGroup;

    use crate::prelude::*;
    use schemas::train_schedule::Comfort;
    use schemas::train_schedule::Distribution;
    use schemas::train_schedule::Margins;
    use schemas::train_schedule::TrainScheduleOptions;

    fn simple_paced_train_changeset(train_schedule_set_id: i64) -> Changeset<TrainSchedule> {
        Changeset::<TrainSchedule>::from(schemas::paced_train::TrainSchedule {
            train_occurrence: schemas::train_schedule::TrainOccurrence::fake(),
            paced: Some(schemas::paced_train::Paced {
                time_window: chrono::Duration::try_hours(2).unwrap().try_into().unwrap(),
                interval: chrono::Duration::try_minutes(15)
                    .unwrap()
                    .try_into()
                    .unwrap(),
                exceptions: vec![],
            }),
        })
        .train_schedule_set_id(train_schedule_set_id)
    }

    fn simple_sub_category(
        code: &str,
        main_category: crate::rolling_stock::TrainMainCategory,
    ) -> Changeset<SubCategory> {
        SubCategory::changeset()
            .code(code.to_string())
            .name(code.to_uppercase())
            .main_category(main_category)
            .color(
                "#ff0000"
                    .parse::<schemas::rolling_stock::SubCategoryColor>()
                    .unwrap(),
            )
            .background_color(
                "#ff2200"
                    .parse::<schemas::rolling_stock::SubCategoryColor>()
                    .unwrap(),
            )
            .hovered_color(
                "#ff4400"
                    .parse::<schemas::rolling_stock::SubCategoryColor>()
                    .unwrap(),
            )
    }

    pub fn create_paced_train() -> TrainSchedule {
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
            start_time: ms_since_epoch("2025-05-15T12:00:00Z"),
            time_window: chrono::Duration::try_hours(2),
            interval: chrono::Duration::try_minutes(30),
            sub_category: None,
        }
    }

    #[rstest]
    #[case(
        chrono::Duration::try_hours(2),
        chrono::Duration::try_minutes(30),
        0,
        true
    )]
    #[case(
        chrono::Duration::try_hours(2),
        chrono::Duration::try_minutes(30),
        1,
        true
    )]
    #[case(
        chrono::Duration::try_hours(2),
        chrono::Duration::try_minutes(30),
        3,
        true
    )]
    #[case(
        chrono::Duration::try_hours(2),
        chrono::Duration::try_minutes(30),
        4,
        false
    )]
    #[case(
        chrono::Duration::try_hours(2),
        chrono::Duration::try_minutes(30),
        100,
        false
    )]
    #[case(chrono::Duration::try_hours(2), chrono::Duration::try_minutes(30), -1, false)]
    #[case(
        chrono::Duration::try_seconds(120),
        chrono::Duration::try_seconds(50),
        3,
        false
    )]
    #[case(
        chrono::Duration::try_minutes(60),
        chrono::Duration::try_minutes(25),
        2,
        true
    )]
    #[case(
        chrono::Duration::try_minutes(60),
        chrono::Duration::try_minutes(25),
        3,
        false
    )]
    fn train_schedule_is_exception_occurrence_index_invalid(
        #[case] time_window: Option<chrono::Duration>,
        #[case] interval: Option<chrono::Duration>,
        #[case] occurrence_index: i64,
        #[case] expected_valid: bool,
    ) {
        let mut train_schedule = create_paced_train();
        train_schedule.time_window = time_window;
        train_schedule.interval = interval;
        assert_eq!(
            train_schedule.is_exception_occurrence_index_valid(occurrence_index),
            expected_valid
        );
    }

    #[test]
    fn has_same_pace_when_nothing_changed() {
        let train_schedule = create_paced_train();
        let train_schedule_update: schemas::paced_train::TrainSchedule =
            train_schedule_schema_from_model(create_paced_train(), vec![]);
        assert!(train_schedule.has_same_pace(train_schedule_update.paced.as_ref()));
    }

    #[test]
    fn has_not_same_pace_when_interval_changed() {
        let train_schedule = create_paced_train();
        let mut train_schedule_update: schemas::paced_train::TrainSchedule =
            train_schedule_schema_from_model(create_paced_train(), vec![]);
        train_schedule_update.paced.as_mut().unwrap().interval =
            chrono::Duration::minutes(60).try_into().unwrap();
        assert!(!train_schedule.has_same_pace(train_schedule_update.paced.as_ref()));
    }

    #[test]
    fn has_not_same_pace_when_time_window_changed() {
        let train_schedule = create_paced_train();
        let mut train_schedule_update: schemas::paced_train::TrainSchedule =
            train_schedule_schema_from_model(create_paced_train(), vec![]);
        train_schedule_update.paced.as_mut().unwrap().time_window =
            chrono::Duration::hours(4).try_into().unwrap();
        assert!(!train_schedule.has_same_pace(train_schedule_update.paced.as_ref()));
    }

    #[tokio::test]
    async fn paced_train_main_category_apply_exception() {
        let mut exception = TrainScheduleException::fixture_created(None);
        exception.change_groups = TrainScheduleExceptionChangeGroups {
            rolling_stock_category: Some(RollingStockCategoryChangeGroup {
                value: Some(schemas::rolling_stock::TrainCategory::Main {
                    main_category: schemas::rolling_stock::TrainMainCategory::FastFreightTrain,
                }),
            }),
            ..Default::default()
        };

        // The paced train has HighSpeedTrain
        let paced_train = create_paced_train();

        let paced_train_exception = paced_train.apply_train_schedule_exception(&exception.into());

        // Check if it get replaced by exception category
        assert_eq!(
            paced_train_exception.category,
            Some(schemas::rolling_stock::TrainCategory::Main {
                main_category: schemas::rolling_stock::TrainMainCategory::FastFreightTrain
            })
        );
    }

    #[rstest]
    #[case::created(TrainScheduleException::fixture_created(None))]
    #[case::modified(TrainScheduleException::fixture_created(Some(0)))]
    #[tokio::test]
    async fn paced_train_apply_exception(#[case] exception: TrainScheduleException) {
        let exception: schemas::TrainScheduleException = exception.into();
        let paced_train = create_paced_train();
        let paced_train_exception = paced_train.apply_train_schedule_exception(&exception);

        assert_eq!(
            paced_train_exception.train_name,
            exception.change_groups.train_name.unwrap().value
        );
        assert_eq!(
            paced_train_exception.rolling_stock_name,
            exception
                .change_groups
                .rolling_stock
                .clone()
                .unwrap()
                .rolling_stock_name
        );
        assert_eq!(
            paced_train_exception.comfort,
            exception.change_groups.rolling_stock.unwrap().comfort
        );
        assert_eq!(
            paced_train_exception.initial_speed,
            exception.change_groups.initial_speed.unwrap().value
        );
        // Check if the category of the paced train that has a category is removed by an exception.
        assert_eq!(paced_train_exception.category, None);
        assert_eq!(
            paced_train_exception.constraint_distribution,
            exception
                .change_groups
                .constraint_distribution
                .unwrap()
                .value
        );
        assert_eq!(
            paced_train_exception.labels,
            exception.change_groups.labels.unwrap().value
        );
        assert_eq!(
            paced_train_exception.margins,
            exception
                .change_groups
                .path_and_schedule
                .clone()
                .unwrap()
                .margins
        );
        assert_eq!(
            paced_train_exception.path,
            exception
                .change_groups
                .path_and_schedule
                .clone()
                .unwrap()
                .path
        );
        assert_eq!(
            paced_train_exception.power_restrictions,
            exception
                .change_groups
                .path_and_schedule
                .clone()
                .unwrap()
                .power_restrictions
        );
        assert_eq!(
            paced_train_exception.schedule,
            exception
                .change_groups
                .path_and_schedule
                .clone()
                .unwrap()
                .schedule
        );
        assert_eq!(
            paced_train_exception.speed_limit_tag,
            exception.change_groups.speed_limit_tag.unwrap().value
        );
        assert_eq!(
            paced_train_exception.options,
            exception.change_groups.options.unwrap().value
        );
    }

    #[tokio::test]
    async fn num_base_occurrences_without_exceptions() {
        let paced_train = create_paced_train();
        assert_eq!(paced_train.num_base_occurrences(), 4);
    }

    #[tokio::test]
    async fn num_base_occurrences_with_exceptions() {
        let paced_train = create_paced_train();
        assert_eq!(paced_train.num_base_occurrences(), 4);
    }

    #[tokio::test]
    async fn iter_occurrences_with_exceptions() {
        let exception_1: schemas::TrainScheduleException = TrainScheduleException {
            id: 1,
            timetable_id: 1,
            train_schedule_id: 1,
            occurrence_index: Some(1),
            disabled: false,
            change_groups: TrainScheduleExceptionChangeGroups::fixture_modified(),
        }
        .into();

        let exception_2: schemas::TrainScheduleException = TrainScheduleException {
            id: 2,
            timetable_id: 1,
            train_schedule_id: 1,
            occurrence_index: None,
            disabled: false,
            change_groups: TrainScheduleExceptionChangeGroups::fixture_created(),
        }
        .into();
        let exception_3: schemas::TrainScheduleException = TrainScheduleException {
            id: 3,
            timetable_id: 1,
            train_schedule_id: 1,
            occurrence_index: Some(0),
            disabled: true,
            change_groups: TrainScheduleExceptionChangeGroups::fixture_modified(),
        }
        .into();

        let paced_train = create_paced_train();
        let exceptions: Vec<schemas::TrainScheduleException> = vec![
            exception_1.clone(),
            exception_2.clone(),
            exception_3.clone(),
        ];

        let occurrences: Vec<_> = paced_train.iter_occurrences(&exceptions).collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<Offset> = occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<_> = occurrences.iter().map(|(t, _)| t.clone()).collect();

        assert_eq!(
            start_times,
            vec![
                ms_since_epoch("2025-05-15T12:30:00Z"),
                ms_since_epoch("2025-05-15T13:00:00Z"),
                ms_since_epoch("2025-05-15T13:10:00Z"),
                ms_since_epoch("2025-05-15T13:30:00Z"),
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
                OccurrenceId::new_modified(paced_train.id, 1, 1),
                OccurrenceId::new_base(paced_train.id, 2),
                OccurrenceId::new_created(paced_train.id, 2),
                OccurrenceId::new_base(paced_train.id, 3),
            ]
        );
    }

    #[tokio::test]
    async fn iter_occurrences_with_modified_start_time_exception() {
        let mut exception_1 = TrainScheduleException::fixture_modified(1);
        exception_1.change_groups.start_time = Some(StartTimeChangeGroup {
            value: ms_since_epoch("2025-05-15T12:31:00Z"),
        });
        let exception_1: schemas::TrainScheduleException = TrainScheduleException {
            id: 1,
            timetable_id: 1,
            train_schedule_id: 1,
            occurrence_index: Some(1),
            disabled: false,
            change_groups: exception_1.change_groups,
        }
        .into();

        let paced_train = create_paced_train();
        let occurrences: Vec<_> = paced_train
            .iter_occurrences(std::slice::from_ref(&exception_1))
            .collect();

        assert_eq!(occurrences.len(), 4);

        let start_times: Vec<Offset> = occurrences.iter().map(|(_, o)| o.start_time).collect();
        let train_names: Vec<String> = occurrences
            .iter()
            .map(|(_, o)| o.train_name.clone())
            .collect();
        let types: Vec<_> = occurrences.iter().map(|(t, _)| t.clone()).collect();

        assert_eq!(
            start_times,
            vec![
                ms_since_epoch("2025-05-15T12:00:00Z"),
                ms_since_epoch("2025-05-15T12:31:00Z"),
                ms_since_epoch("2025-05-15T13:00:00Z"),
                ms_since_epoch("2025-05-15T13:30:00Z"),
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
                OccurrenceId::new_modified(paced_train.id, 1, exception_1.id),
                OccurrenceId::new_base(paced_train.id, 2),
                OccurrenceId::new_base(paced_train.id, 3),
            ]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn paced_train_both_categories_check_post() {
        let pool = DbConnectionPoolV2::for_tests();

        let timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");
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
            crate::Error::CheckViolation {
                constraint: "only_one_category".to_string(),
            }
        );
    }
}
