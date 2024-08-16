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

    #[strum(serialize = "electrical_profile_set:read")]
    ElectricalProfileSetRead,
    #[strum(serialize = "electrical_profile_set:write")]
    ElectricalProfileSetWrite,
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        use BuiltinRole::*;
        match self {
            OpsWrite => vec![InfraRead],
            InfraRead => vec![],
            InfraWrite => vec![InfraRead],
            ElectricalProfileSetRead => vec![],
            ElectricalProfileSetWrite => vec![ElectricalProfileSetRead],
        }
    }
}
