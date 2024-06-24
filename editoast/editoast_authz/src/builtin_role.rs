use strum::{AsRefStr, EnumString};

use crate::roles::BuiltinRoleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, EnumString, AsRefStr)]
#[strum(serialize_all = "snake_case")]
pub enum BuiltinRole {
    #[strum(serialize = "operational_studies_write")]
    OpsWrite,
}

impl BuiltinRoleSet for BuiltinRole {
    fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
        match self {
            Self::OpsWrite => vec![],
        }
    }
}
