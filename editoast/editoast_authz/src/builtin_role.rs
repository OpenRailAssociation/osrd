use strum::{AsRefStr, EnumString};

use crate::roles::BuiltinRoleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, EnumString, AsRefStr)]
#[strum(serialize_all = "snake_case")]
pub enum BuiltinRole {
    // Unused (in editoast) builtin roles used to detemine which apps the user can access in the front end
    #[strum(serialize = "section:map")]
    MapSection, // not to be used for endpoint security

    // Builtin roles protecting endpoints
    #[strum(serialize = "operational_studies:read")]
    OpsRead,
    #[strum(serialize = "operational_studies:write")]
    OpsWrite,

    #[strum(serialize = "map:read")]
    MapRead,

    #[strum(serialize = "infra:read")]
    InfraRead,
    #[strum(serialize = "infra:write")]
    InfraWrite,

    #[strum(serialize = "rolling_stock_collection:read")]
    RollingStockCollectionRead,
    #[strum(serialize = "rolling_stock_collection:write")]
    RollingStockCollectionWrite,

    #[strum(serialize = "convoy:read")]
    ConvoyRead,
    #[strum(serialize = "convoy:write")]
    ConvoyWrite,

    #[strum(serialize = "timetable:read")]
    TimetableRead,
    #[strum(serialize = "timetable:write")]
    TimetableWrite,

    #[strum(serialize = "document:read")]
    DocumentRead,
    #[strum(serialize = "document:write")]
    DocumentWrite,

    #[strum(serialize = "work_schedule:read")]
    WorkScheduleRead,
    #[strum(serialize = "work_schedule:write")]
    WorkScheduleWrite,

    #[strum(serialize = "stdcm")]
    Stdcm,
    #[strum(serialize = "stdcm:debug")]
    StdcmDebug,

    #[strum(serialize = "subject:read")]
    SubjectRead,
    #[strum(serialize = "subject:write")]
    SubjectWrite,

    #[strum(serialize = "role:read")]
    RoleRead,
    #[strum(serialize = "role:write")]
    RoleWrite,

    #[strum(serialize = "grant:read")]
    GrantRead,
    #[strum(serialize = "grant:write")]
    GrantWrite,
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        use BuiltinRole::*;
        match self {
            MapSection => vec![MapRead],
            OpsRead => vec![InfraRead, MapRead],
            OpsWrite => vec![OpsRead],
            MapRead => vec![],
            InfraRead => vec![],
            InfraWrite => vec![InfraRead],
            RollingStockCollectionRead => vec![],
            RollingStockCollectionWrite => vec![RollingStockCollectionRead],
            ConvoyRead => vec![],
            ConvoyWrite => vec![ConvoyRead],
            TimetableRead => vec![],
            TimetableWrite => vec![TimetableRead],
            DocumentRead => vec![],
            DocumentWrite => vec![DocumentRead],
            WorkScheduleRead => vec![],
            WorkScheduleWrite => vec![WorkScheduleRead],
            Stdcm => vec![MapRead],
            StdcmDebug => vec![Stdcm],
            SubjectRead => vec![],
            SubjectWrite => vec![SubjectRead],
            RoleRead => vec![],
            RoleWrite => vec![RoleRead],
            GrantRead => vec![],
            GrantWrite => vec![GrantRead],
        }
    }
}
