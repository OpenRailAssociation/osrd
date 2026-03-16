use serde::Deserialize;
use serde::Serialize;
use serde_with::serde_as;
use serde_with::skip_serializing_none;
use utoipa::ToSchema;

use crate::paced_train::ConstraintDistributionChangeGroup;
use crate::paced_train::InitialSpeedChangeGroup;
use crate::paced_train::LabelsChangeGroup;
use crate::paced_train::OptionsChangeGroup;
use crate::paced_train::PathAndScheduleChangeGroup;
use crate::paced_train::RollingStockCategoryChangeGroup;
use crate::paced_train::RollingStockChangeGroup;
use crate::paced_train::SpeedLimitTagChangeGroup;
use crate::paced_train::StartTimeChangeGroup;
use crate::paced_train::TrainNameChangeGroup;

#[skip_serializing_none]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainScheduleException {
    pub id: i64,
    pub key: Option<String>,
    pub timetable_id: i64,
    pub train_schedule_id: i64,
    /// If None the exception is created, otherwise it is a modified exception
    #[schema(nullable = false)]
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    pub change_groups: TrainScheduleExceptionChangeGroups,
}

#[skip_serializing_none]
#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[cfg_attr(feature = "testing", derive(Default))]
pub struct TrainScheduleExceptionChangeGroups {
    #[schema(nullable = false)]
    pub train_name: Option<TrainNameChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock: Option<RollingStockChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock_category: Option<RollingStockCategoryChangeGroup>,
    #[schema(nullable = false)]
    pub labels: Option<LabelsChangeGroup>,
    #[schema(nullable = false)]
    pub speed_limit_tag: Option<SpeedLimitTagChangeGroup>,
    #[schema(nullable = false)]
    pub start_time: Option<StartTimeChangeGroup>,
    #[schema(nullable = false)]
    pub constraint_distribution: Option<ConstraintDistributionChangeGroup>,
    #[schema(nullable = false)]
    pub initial_speed: Option<InitialSpeedChangeGroup>,
    #[schema(nullable = false)]
    pub options: Option<OptionsChangeGroup>,
    #[schema(nullable = false)]
    pub path_and_schedule: Option<PathAndScheduleChangeGroup>,
}

#[cfg(any(test, feature = "testing"))]
impl TrainScheduleExceptionChangeGroups {
    pub fn fake_created() -> Self {
        use std::str::FromStr;

        use chrono::DateTime;
        use chrono::Utc;

        use crate::infra::TrackOffset;
        use crate::primitives::Identifier;
        use crate::primitives::NonBlankString;
        use crate::train_schedule::Comfort;
        use crate::train_schedule::Distribution;
        use crate::train_schedule::MarginValue;
        use crate::train_schedule::Margins;
        use crate::train_schedule::OperationalPointPartReference;
        use crate::train_schedule::OperationalPointReference;
        use crate::train_schedule::PathItem;
        use crate::train_schedule::PathItemLocation;
        use crate::train_schedule::ScheduleItem;
        use crate::train_schedule::TrainScheduleOptions;

        Self {
            train_name: Some(TrainNameChangeGroup {
                value: "created_exception_train_name".into(),
            }),
            constraint_distribution: Some(ConstraintDistributionChangeGroup {
                value: Distribution::Mareco,
            }),
            initial_speed: Some(InitialSpeedChangeGroup { value: 10.0 }),
            labels: Some(LabelsChangeGroup {
                value: vec!["Label 1".to_string(), "Label 3".to_string()],
            }),
            options: Some(OptionsChangeGroup {
                value: TrainScheduleOptions::default(),
            }),
            path_and_schedule: Some(PathAndScheduleChangeGroup {
                power_restrictions: vec![],
                schedule: vec![
                    ScheduleItem {
                        at: NonBlankString("aa".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("bb".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("cc".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("dd".to_string()),
                        ..Default::default()
                    },
                ],
                path: vec![
                    PathItem {
                        id: "aa".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC0".to_string()),
                        }),
                    },
                    PathItem {
                        id: "bb".into(),
                        location: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Id {
                                    operational_point: Identifier("Mid_East_station".to_string()),
                                },
                                local_track_name: None,
                            },
                        ),
                    },
                    PathItem {
                        id: "cc".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC1".to_string()),
                        }),
                    },
                    PathItem {
                        id: "dd".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC2".to_string()),
                        }),
                    },
                ],
                margins: Margins {
                    boundaries: vec![],
                    values: vec![MarginValue::Percentage(5.0)],
                },
            }),
            rolling_stock: Some(RollingStockChangeGroup {
                rolling_stock_name: "simulation_rolling_stock".into(),
                comfort: Comfort::AirConditioning,
            }),
            rolling_stock_category: Some(RollingStockCategoryChangeGroup { value: None }),
            speed_limit_tag: Some(SpeedLimitTagChangeGroup {
                value: Some(NonBlankString("GB".into())),
            }),
            start_time: Some(StartTimeChangeGroup {
                value: DateTime::<Utc>::from_str("2025-05-15T15:10:00+02:00").unwrap(),
            }),
        }
    }

    pub fn fake_modified() -> Self {
        let mut created = Self::fake_created();
        created.start_time = None;
        created.train_name = Some(TrainNameChangeGroup {
            value: "modified_exception_train_name".to_string(),
        });
        created
    }
}
