use crate::rolling_stock::TrainMainCategory;
use crate::sea_orm_types::ForeignJson;
use crate::sea_orm_types::Interval;
use crate::sea_orm_types::Milliseconds;
use crate::tags::Tags;
use chrono::Duration as ChronoDuration;
use common::units::millisecond;
use common::units::quantities::Offset;
use derive_more::Display;
use itertools::Itertools;
use schemas;
use schemas::TrainScheduleException;
use schemas::paced_train;
use schemas::paced_train::Paced;
use schemas::paced_train::PacedTrainException;
use schemas::rolling_stock::TrainCategory;
use schemas::train_schedule::Margins;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PowerRestrictionItem;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainOccurrence;
use schemas::train_schedule::TrainScheduleOptions;
use sea_orm::ActiveValue::Set;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use std::fmt::Display;
use utoipa::ToSchema;

#[derive(Debug, Clone, DeriveEntityModel, PartialEq)]
#[sea_orm(table_name = "train_schedule")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub train_name: String,
    pub labels: Tags,
    pub rolling_stock_name: String,
    pub train_schedule_set_id: i64,
    /// For calendar timetables: elapsed ms since 1970-01-01T00:00:00Z.
    /// For hourly timetables: elapsed ms since the timetable start.
    pub start_time: Milliseconds,
    #[sea_orm(column_type = "JsonBinary")]
    pub schedule: ForeignJson<Vec<ScheduleItem>>,
    #[sea_orm(column_type = "JsonBinary")]
    pub margins: ForeignJson<Margins>,
    pub initial_speed: f64,
    pub comfort: Comfort,
    #[sea_orm(column_type = "JsonBinary")]
    pub path: ForeignJson<Vec<PathItem>>,
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    #[sea_orm(column_type = "JsonBinary")]
    pub power_restrictions: ForeignJson<Vec<PowerRestrictionItem>>,
    #[sea_orm(column_type = "JsonBinary")]
    pub options: ForeignJson<TrainScheduleOptions>,
    /// Time window of the paced train
    #[sea_orm(save_as = "interval")]
    pub time_window: Option<Interval>,
    /// Time between two occurrences
    #[sea_orm(save_as = "interval")]
    pub interval: Option<Interval>,
    pub main_category: Option<TrainMainCategory>,
    /// Sub category code
    pub sub_category: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, DeriveActiveEnum, EnumIter, Eq, PartialEq)]
#[sea_orm(rs_type = "i16", db_type = "SmallInteger")]
pub enum Comfort {
    #[default]
    Standard = 0,
    AirConditioning = 1,
    Heating = 2,
}

#[derive(Clone, Copy, Debug, Default, DeriveActiveEnum, EnumIter, Eq, PartialEq)]
#[sea_orm(rs_type = "i16", db_type = "SmallInteger")]
pub enum Distribution {
    #[default]
    Standard = 0,
    Mareco = 1,
}

impl From<schemas::train_schedule::Comfort> for Comfort {
    fn from(value: schemas::train_schedule::Comfort) -> Self {
        match value {
            schemas::train_schedule::Comfort::Standard => Self::Standard,
            schemas::train_schedule::Comfort::AirConditioning => Self::AirConditioning,
            schemas::train_schedule::Comfort::Heating => Self::Heating,
        }
    }
}

impl From<Comfort> for schemas::train_schedule::Comfort {
    fn from(value: Comfort) -> Self {
        match value {
            Comfort::Standard => Self::Standard,
            Comfort::AirConditioning => Self::AirConditioning,
            Comfort::Heating => Self::Heating,
        }
    }
}

impl From<schemas::train_schedule::Distribution> for Distribution {
    fn from(value: schemas::train_schedule::Distribution) -> Self {
        match value {
            schemas::train_schedule::Distribution::Standard => Self::Standard,
            schemas::train_schedule::Distribution::Mareco => Self::Mareco,
        }
    }
}

impl From<Distribution> for schemas::train_schedule::Distribution {
    fn from(value: Distribution) -> Self {
        match value {
            Distribution::Standard => Self::Standard,
            Distribution::Mareco => Self::Mareco,
        }
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::sub_category::Entity",
        from = "Column::SubCategory",
        to = "super::sub_category::Column::Code",
        on_delete = "SetNull"
    )]
    SubCategory,
    #[sea_orm(has_many = "super::train_schedule_exception::Entity")]
    Exception,
    #[sea_orm(
        belongs_to = "super::train_schedule_set::Entity",
        from = "Column::TrainScheduleSetId",
        to = "super::train_schedule_set::Column::Id",
        on_delete = "Cascade"
    )]
    TrainScheduleSet,
}

impl Related<super::sub_category::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SubCategory.def()
    }
}

impl Related<super::train_schedule_exception::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Exception.def()
    }
}

impl Related<super::train_schedule_set::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainScheduleSet.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

/// Transforms the TrainSchedule database type into a paced_train::TrainSchedule schema with exceptions.
pub fn train_schedule_schema_from_model(
    train_schedule: Model,
    exceptions: Vec<PacedTrainException>,
) -> paced_train::TrainSchedule {
    paced_train::TrainSchedule {
        train_occurrence: TrainOccurrence {
            train_name: train_schedule.train_name,
            labels: train_schedule.labels.to_vec(),
            rolling_stock_name: train_schedule.rolling_stock_name,
            start_time: train_schedule.start_time.into(),
            schedule: train_schedule.schedule.into_inner(),
            margins: train_schedule.margins.into_inner(),
            initial_speed: train_schedule.initial_speed,
            comfort: train_schedule.comfort.into(),
            path: train_schedule.path.into_inner(),
            constraint_distribution: train_schedule.constraint_distribution.into(),
            speed_limit_tag: train_schedule.speed_limit_tag.map(Into::into),
            power_restrictions: train_schedule.power_restrictions.into_inner(),
            options: train_schedule.options.into_inner(),
            category: train_schedule
                .main_category
                .map(|main_category| TrainCategory::main(main_category.into()))
                .xor(train_schedule.sub_category.map(TrainCategory::sub)),
        },
        paced: train_schedule.time_window.and_then(|time_window| {
            train_schedule.interval.map(|interval| Paced {
                time_window: ChronoDuration::from(time_window).try_into().unwrap(),
                interval: ChronoDuration::from(interval).try_into().unwrap(),
                exceptions,
            })
        }),
    }
}

impl Model {
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
            path: self.path.into_inner(),
            start_time: self.start_time.into(),
            schedule: self.schedule.into_inner(),
            margins: self.margins.into_inner(),
            initial_speed: self.initial_speed,
            comfort: self.comfort.into(),
            constraint_distribution: self.constraint_distribution.into(),
            speed_limit_tag: self.speed_limit_tag.map(|s| s.into()),
            power_restrictions: self.power_restrictions.into_inner(),
            options: self.options.into_inner(),
            category: self
                .main_category
                .map(|main_category| TrainCategory::main(main_category.into()))
                .xor(self.sub_category.map(TrainCategory::sub)),
        }
    }

    /// Returns the start time of the occurrence at the given index.
    fn get_occurrence_start_time(&self, occurrence_index: usize) -> Offset {
        if let Some(interval) = self.interval {
            let start_time: Offset = self.start_time.into();
            let interval: ChronoDuration = interval.into();
            start_time
                + common::units::millisecond::i64::new(
                    (interval * occurrence_index as i32).num_milliseconds(),
                )
        } else {
            self.start_time.into()
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
        self.time_window
            .zip(self.interval)
            .map(|(time_window, interval)| (time_window.into(), interval.into()))
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
        self.interval
            == paced
                .as_ref()
                .map(|p| Interval::from(ChronoDuration::from(p.interval)))
            && self.time_window
                == paced
                    .as_ref()
                    .map(|p| Interval::from(ChronoDuration::from(p.time_window)))
    }
}

impl From<paced_train::TrainSchedule> for ActiveModel {
    fn from(
        paced_train::TrainSchedule {
            train_occurrence,
            paced,
        }: paced_train::TrainSchedule,
    ) -> Self {
        let mut active_model = Self {
            comfort: Set(train_occurrence.comfort.into()),
            constraint_distribution: Set(train_occurrence.constraint_distribution.into()),
            initial_speed: Set(train_occurrence.initial_speed),
            labels: Set(Tags::new(train_occurrence.labels)),
            margins: Set(ForeignJson::new(train_occurrence.margins)),
            path: Set(ForeignJson::new(train_occurrence.path)),
            power_restrictions: Set(ForeignJson::new(train_occurrence.power_restrictions)),
            rolling_stock_name: Set(train_occurrence.rolling_stock_name),
            schedule: Set(ForeignJson::new(train_occurrence.schedule)),
            speed_limit_tag: Set(train_occurrence.speed_limit_tag.map(|s| s.0)),
            start_time: Set(train_occurrence.start_time.into()),
            train_name: Set(train_occurrence.train_name),
            options: Set(ForeignJson::new(train_occurrence.options)),
            time_window: Set(paced
                .as_ref()
                .map(|p| Interval::from(ChronoDuration::from(p.time_window)))),
            interval: Set(paced
                .as_ref()
                .map(|p| Interval::from(ChronoDuration::from(p.interval)))),
            ..Default::default()
        };

        match train_occurrence.category {
            Some(TrainCategory::Main { main_category }) => {
                active_model.main_category = Set(Some(main_category.into()));
                active_model.sub_category = Set(None);
            }
            Some(TrainCategory::Sub { sub_category_code }) => {
                active_model.sub_category = Set(Some(sub_category_code));
                active_model.main_category = Set(None);
            }
            None => {
                active_model.sub_category = Set(None);
                active_model.main_category = Set(None);
            }
        }
        active_model
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

    pub fn train_schedule_id(&self) -> i64 {
        match self {
            Self::Base {
                train_schedule_id, ..
            }
            | Self::Created {
                train_schedule_id, ..
            }
            | Self::Modified {
                train_schedule_id, ..
            } => *train_schedule_id,
        }
    }

    pub fn index(&self) -> Option<usize> {
        match self {
            Self::Base { index, .. } | Self::Modified { index, .. } => Some(*index),
            Self::Created { .. } => None,
        }
    }

    pub fn added_exception_id(&self) -> Option<i64> {
        match self {
            Self::Base { .. } | Self::Modified { .. } => None,
            Self::Created { exception_id, .. } => Some(*exception_id),
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
    use crate::rolling_stock::TrainMainCategory;
    use crate::sea_orm_types::ForeignJson;
    use crate::sea_orm_types::Interval;
    use crate::sub_category;
    use crate::tags::Tags;
    use crate::timetable;
    use crate::train_schedule;
    use crate::train_schedule::train_schedule_schema_from_model;
    use crate::train_schedule_exception;

    use super::OccurrenceId;
    use common::units::quantities::Offset;
    use database::Db;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::fixtures::ms_since_epoch;
    use schemas::paced_train::RollingStockCategoryChangeGroup;
    use schemas::paced_train::StartTimeChangeGroup;

    use schemas::train_schedule::Margins;
    use schemas::train_schedule::TrainScheduleOptions;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::Set;

    fn simple_paced_train_active_model(train_schedule_set_id: i64) -> train_schedule::ActiveModel {
        let mut active: train_schedule::ActiveModel = create_paced_train().into();
        active.id = Default::default();
        active.train_schedule_set_id = Set(train_schedule_set_id);
        active
    }

    fn simple_sub_category(
        code: &str,
        main_category: TrainMainCategory,
    ) -> sub_category::ActiveModel {
        sub_category::ActiveModel {
            code: Set(code.to_string()),
            name: Set(code.to_uppercase()),
            main_category: Set(main_category),
            color: Set("#ff0000".to_owned().into()),
            background_color: Set("#ff2200".to_owned().into()),
            hovered_color: Set("#ff4400".to_owned().into()),
            ..Default::default()
        }
    }

    pub fn create_paced_train() -> train_schedule::Model {
        train_schedule::Model {
            id: 1,
            train_schedule_set_id: 1,
            train_name: "train_name".to_string(),
            rolling_stock_name: "R2D2".to_string(),
            comfort: train_schedule::Comfort::Standard,
            initial_speed: 25.0,
            main_category: Some(TrainMainCategory::HighSpeedTrain),
            constraint_distribution: train_schedule::Distribution::Standard,
            labels: Tags::new(vec![]),
            margins: ForeignJson::new(Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            }),
            path: ForeignJson::new(vec![]),
            power_restrictions: ForeignJson::new(vec![]),
            schedule: ForeignJson::new(vec![]),
            speed_limit_tag: None,
            options: ForeignJson::new(TrainScheduleOptions::default()),
            start_time: ms_since_epoch("2025-05-15T12:00:00Z").into(),
            time_window: chrono::Duration::try_hours(2).map(Interval::from),
            interval: chrono::Duration::try_minutes(30).map(Interval::from),
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
        train_schedule.time_window = time_window.map(Interval::from);
        train_schedule.interval = interval.map(Interval::from);
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
        let mut exception = train_schedule_exception::Model::fixture_created("key_1", None);
        *exception.change_groups = TrainScheduleExceptionChangeGroups {
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
    #[case::created(train_schedule_exception::Model::fixture_created("key_1", None))]
    #[case::modified(train_schedule_exception::Model::fixture_created("key_2", Some(0)))]
    #[tokio::test]
    async fn paced_train_apply_exception(#[case] exception: train_schedule_exception::Model) {
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
        let exception_1: schemas::TrainScheduleException = train_schedule_exception::Model {
            id: 1,
            timetable_id: 1,
            train_schedule_id: 1,
            key: Some("key_1".into()),
            occurrence_index: Some(1),
            disabled: false,
            change_groups: ForeignJson::new(TrainScheduleExceptionChangeGroups::fixture_modified()),
        }
        .into();

        let exception_2: schemas::TrainScheduleException = train_schedule_exception::Model {
            id: 2,
            timetable_id: 1,
            train_schedule_id: 1,
            key: Some("key_2".into()),
            occurrence_index: None,
            disabled: false,
            change_groups: ForeignJson::new(TrainScheduleExceptionChangeGroups::fixture_created()),
        }
        .into();
        let exception_3: schemas::TrainScheduleException = train_schedule_exception::Model {
            id: 3,
            timetable_id: 1,
            train_schedule_id: 1,
            key: Some("key_3".into()),
            occurrence_index: Some(0),
            disabled: true,
            change_groups: ForeignJson::new(TrainScheduleExceptionChangeGroups::fixture_modified()),
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
        let mut exception_1 = train_schedule_exception::Model::fixture_modified("key_1", 1);
        exception_1.change_groups.start_time = Some(StartTimeChangeGroup {
            value: ms_since_epoch("2025-05-15T12:31:00Z"),
        });
        let exception_1: schemas::TrainScheduleException = train_schedule_exception::Model {
            id: 1,
            timetable_id: 1,
            train_schedule_id: 1,
            key: Some("key_1".into()),
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
        let db = Db::for_tests().await;

        let timetable = <timetable::ActiveModel as Default>::default()
            .insert(&db)
            .await
            .expect("Failed to create timetable");
        let paced_train_active_model = simple_paced_train_active_model(timetable.id);
        let created_sub_category = simple_sub_category("tjv", TrainMainCategory::HighSpeedTrain)
            .insert(&db)
            .await
            .expect("Failed to create sub category");

        let mut train_schedule_active_model = paced_train_active_model;
        train_schedule_active_model.sub_category = Set(Some(created_sub_category.code));
        train_schedule_active_model.main_category = Set(Some(TrainMainCategory::HighSpeedTrain));
        let error = train_schedule_active_model.insert(&db).await.unwrap_err();

        assert!(crate::Error::from(error).is_check_violation("only_one_category"));
    }
}
