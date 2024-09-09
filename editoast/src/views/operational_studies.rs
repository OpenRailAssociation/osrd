use crate::models::prelude::*;
use crate::models::Project;
use crate::models::Scenario;
use crate::models::Study;

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
#[into_params(parameter_in = Query)]
pub struct OperationalStudiesOrderingParam {
    #[serde(default)]
    pub ordering: Ordering,
}

impl Ordering {
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
