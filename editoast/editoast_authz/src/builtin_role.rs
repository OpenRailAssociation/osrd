use strum::{AsRefStr, EnumString};

use crate::roles::BuiltinRoleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, EnumString, AsRefStr)]
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
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        use BuiltinRole::*;
        match self {
            OpsRead => vec![],
            OpsWrite => vec![OpsRead],
            InfraRead => vec![],
            InfraWrite => vec![InfraRead],
        }
    }
}
