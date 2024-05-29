use crate::modelsv2::prelude::*;
use crate::modelsv2::Project;
use crate::modelsv2::Scenario;
use crate::modelsv2::Study;

editoast_common::schemas! {
    Ordering,
}

#[derive(Debug, Clone, serde::Deserialize, Default, utoipa::ToSchema)]
pub enum Ordering {
    NameAsc,
    NameDesc,
    CreationDateAsc,
    CreationDateDesc,
    #[default]
    LastModifiedDesc,
    LastModifiedAsc,
}

#[derive(Debug, Clone, serde::Deserialize, utoipa::IntoParams)]
pub struct OperationalStudiesOrderingParam {
    #[serde(default)]
    pub ordering: Ordering,
}

impl Ordering {
    pub fn to_sql(&self) -> &str {
        match *self {
            Ordering::NameAsc => "LOWER(t.name) ASC",
            Ordering::NameDesc => " LOWER(t.name) DESC",
            Ordering::CreationDateAsc => "creation_date",
            Ordering::CreationDateDesc => "creation_date DESC",
            Ordering::LastModifiedAsc => "last_modification",
            Ordering::LastModifiedDesc => "last_modification DESC",
        }
    }

    pub fn as_project_ordering(&self) -> SortSetting<Project> {
        match *self {
            Ordering::NameAsc => Project::NAME.asc(),
            Ordering::NameDesc => Project::NAME.desc(),
            Ordering::CreationDateAsc => Project::CREATION_DATE.asc(),
            Ordering::CreationDateDesc => Project::CREATION_DATE.desc(),
            Ordering::LastModifiedAsc => Project::LAST_MODIFICATION.asc(),
            Ordering::LastModifiedDesc => Project::LAST_MODIFICATION.desc(),
        }
    }

    pub fn as_study_ordering(&self) -> SortSetting<Study> {
        match *self {
            Ordering::NameAsc => Study::NAME.asc(),
            Ordering::NameDesc => Study::NAME.desc(),
            Ordering::CreationDateAsc => Study::CREATION_DATE.asc(),
            Ordering::CreationDateDesc => Study::CREATION_DATE.desc(),
            Ordering::LastModifiedAsc => Study::LAST_MODIFICATION.asc(),
            Ordering::LastModifiedDesc => Study::LAST_MODIFICATION.desc(),
        }
    }

    pub fn as_scenario_ordering(&self) -> SortSetting<Scenario> {
        match *self {
            Ordering::NameAsc => Scenario::NAME.asc(),
            Ordering::NameDesc => Scenario::NAME.desc(),
            Ordering::CreationDateAsc => Scenario::CREATION_DATE.asc(),
            Ordering::CreationDateDesc => Scenario::CREATION_DATE.desc(),
            Ordering::LastModifiedAsc => Scenario::LAST_MODIFICATION.asc(),
            Ordering::LastModifiedDesc => Scenario::LAST_MODIFICATION.desc(),
        }
    }
}
