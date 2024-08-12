use strum::{AsRefStr, EnumString};

use crate::roles::BuiltinRoleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, EnumString, AsRefStr)]
#[strum(serialize_all = "snake_case")]
pub enum BuiltinRole {
    #[strum(serialize = "operational_studies:write")]
    OpsWrite,

    #[strum(serialize = "infra:read")]
    InfraRead,
    #[strum(serialize = "infra:write")]
    InfraWrite,

    #[strum(serialize = "rolling_stock_collection:read")]
    RollingStockCollectionRead,

    #[strum(serialize = "train_schedule:read")]
    TrainScheduleRead,

    #[strum(serialize = "work_schedule:write")]
    WorkScheduleWrite,

    #[strum(serialize = "map:read")]
    MapRead,

    #[strum(serialize = "stdcm")]
    Stdcm,
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        use BuiltinRole::*;
        match self {
            OpsWrite => vec![InfraRead],
            InfraRead => vec![],
            InfraWrite => vec![InfraRead],
            RollingStockCollectionRead => vec![],
            TrainScheduleRead => vec![InfraRead],
            WorkScheduleWrite => vec![],
            MapRead => vec![],
            Stdcm => vec![MapRead],
        }
    }
}
