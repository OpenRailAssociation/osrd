use serde::Serialize;
use strum::AsRefStr;
use strum::Display;
use strum::EnumString;
use utoipa::ToSchema;

use crate::roles::BuiltinRoleSet;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, EnumString, AsRefStr, Display, ToSchema,
)]
#[strum(serialize_all = "snake_case")]
pub enum BuiltinRole {
    /// A user with this role short-circuits all role and permission checks
    ///
    /// Alternatively, especially for development, the `EDITOAST_DISABLE_AUTHORIZATION` environment variable can be set
    /// when no user identity header is present. (This is the case when editoast is queried directly and
    /// not through the gateway.)
    #[strum(serialize = "superuser")]
    Superuser,

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
    #[strum(serialize = "work_schedule:read")]
    WorkScheduleRead,

    #[strum(serialize = "map:read")]
    MapRead,

    #[strum(serialize = "stdcm")]
    Stdcm,
    #[strum(serialize = "stdcm:admin")]
    StdcmAdmin,

    #[strum(serialize = "timetable:read")]
    TimetableRead,
    #[strum(serialize = "timetable:write")]
    TimetableWrite,

    #[strum(serialize = "document:read")]
    DocumentRead,
    #[strum(serialize = "document:write")]
    DocumentWrite,

    #[strum(serialize = "subject:read")]
    SubjectRead,
    #[strum(serialize = "subject:write")]
    SubjectWrite,

    #[strum(serialize = "role:read")]
    RoleRead,
    #[strum(serialize = "role:write")]
    RoleWrite,
}

impl BuiltinRoleSet for BuiltinRole {
    fn superuser() -> Self {
        Self::Superuser
    }
}
