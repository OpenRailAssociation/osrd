use serde::Deserialize;
use serde::Serialize;
use strum::AsRefStr;
use strum::EnumString;
use utoipa::ToSchema;

use crate::roles::BuiltinRoleSet;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, EnumString, AsRefStr, ToSchema,
)]
pub enum BuiltinRole {
    /// A user with this role short-circuits all role and permission checks
    ///
    /// Alternatively, especially for development, the `EDITOAST_DISABLE_AUTHORIZATION` environment variable can be set
    /// when no user identity header is present. (This is the case when editoast is queried directly and
    /// not through the gateway.)
    Superuser,

    OpsWrite,
    OpsRead,

    InfraRead,
    InfraWrite,

    RollingStockCollectionRead,
    RollingStockCollectionWrite,

    WorkScheduleWrite,
    WorkScheduleRead,

    MapRead,

    Stdcm,
    StdcmAdmin,

    TimetableRead,
    TimetableWrite,

    DocumentRead,
    DocumentWrite,

    SubjectRead,
    SubjectWrite,

    RoleRead,
    RoleWrite,
}

impl BuiltinRoleSet for BuiltinRole {
    fn superuser() -> Self {
        Self::Superuser
    }
}
