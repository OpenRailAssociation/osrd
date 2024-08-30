use strum::AsRefStr;
use strum::Display;
use strum::EnumString;

use crate::roles::BuiltinRoleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, EnumString, AsRefStr, Display)]
#[strum(serialize_all = "snake_case")]
pub enum BuiltinRole {
    #[strum(serialize = "operational_studies:write")]
    OpsWrite,
    #[strum(serialize = "operational_studies:read")]
    OpsRead,

    #[strum(serialize = "infra:read")]
    InfraRead,
    #[strum(serialize = "infra:write")]
    InfraWrite,

    #[strum(serialize = "rolling_stock_collection:read")]
    RollingStockCollectionRead,
    #[strum(serialize = "rolling_stock_collection:write")]
    RollingStockCollectionWrite,

    #[strum(serialize = "work_schedule:write")]
    WorkScheduleWrite,

    #[strum(serialize = "map:read")]
    MapRead,

    #[strum(serialize = "stdcm")]
    Stdcm,

    #[strum(serialize = "timetable:read")]
    TimetableRead,
    #[strum(serialize = "timetable:write")]
    TimetableWrite,

    #[strum(serialize = "document:read")]
    DocumentRead,
    #[strum(serialize = "document:write")]
    DocumentWrite,

    #[strum(serialize = "admin")]
    Admin,
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        use BuiltinRole::*;
        match self {
            OpsRead => vec![],
            OpsWrite => vec![OpsRead],
            InfraRead => vec![],
            InfraWrite => vec![InfraRead],
            RollingStockCollectionRead => vec![],
            RollingStockCollectionWrite => vec![RollingStockCollectionRead],
            WorkScheduleWrite => vec![],
            MapRead => vec![],
            Stdcm => vec![MapRead],
            TimetableRead => vec![],
            TimetableWrite => vec![TimetableRead],
            DocumentRead => vec![],
            DocumentWrite => vec![DocumentRead],
            Admin => vec![],
        }
    }
}
