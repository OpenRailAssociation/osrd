use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ResourceType {
    Group,
    Project,
    Study,
    Scenario,
    Timetable,
    Infra,
    RollingStockCollection,
}

// Implicit grants propagate explicit grants to related objects. There are two types of implicit grants:
//     explicit grants propagate downwards within hierarchies: Owner, Reader, Writer propagate as is, Creator is reduced to Reader
//     MinimalMetadata propagates up within project hierarchies, so that read access to a study or scenario allows having the name and description of the parent project

// The following objects have implicit grants:

//     project gets MinimalMetadata if the user has any right on a child study or scenario
//     study gets:
//         MinimalMetadata if the user has any right on a child scenario
//         Owner, Reader, Writer if the user has such right on the parent study. Creator is reduced to Reader.
//     scenario gets Owner, Reader, Writer if the user has such right on the parent study or project. Creator is reduced to Reader.
//     train-schedules have the same grants as their timetable

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum EffectivePrivLvl {
    None,
    MinimalMetadata,
    Reader,
    Creator,
    Writer,
    Owner,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum GrantPrivLvl {
    Reader,
    Creator,
    Writer,
    Owner,
}

impl From<GrantPrivLvl> for EffectivePrivLvl {
    fn from(privlvl: GrantPrivLvl) -> Self {
        match privlvl {
            GrantPrivLvl::Reader => EffectivePrivLvl::Reader,
            GrantPrivLvl::Creator => EffectivePrivLvl::Creator,
            GrantPrivLvl::Writer => EffectivePrivLvl::Writer,
            GrantPrivLvl::Owner => EffectivePrivLvl::Owner,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Grant {
    Explict {
        grant_id: i64,
        subject_id: i64,
        resource_id: i64,
        privlvl: EffectivePrivLvl,
        granted_by: Option<i64>,
        granted_at: DateTime<Utc>,
    },
    Implicit {
        subject_id: i64,
        ressource_id: i64,
        privlvl: EffectivePrivLvl,
        source: String,
    },
}

impl Grant {
    pub fn subject_id(&self) -> i64 {
        match self {
            Grant::Explict { subject_id, .. } => *subject_id,
            Grant::Implicit { subject_id, .. } => *subject_id,
        }
    }

    pub fn resource_id(&self) -> i64 {
        match self {
            Grant::Explict { resource_id, .. } => *resource_id,
            Grant::Implicit { ressource_id, .. } => *ressource_id,
        }
    }

    pub fn privlvl(&self) -> EffectivePrivLvl {
        match self {
            Grant::Explict { privlvl, .. } => *privlvl,
            Grant::Implicit { privlvl, .. } => *privlvl,
        }
    }
}
