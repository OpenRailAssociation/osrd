use authz::InfraGrant;
use authz::InfraPrivilege;
use authz::RollingStockGrant;
use authz::RollingStockPrivilege;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(test, derive(Debug, PartialEq))]
pub(super) enum StandardGrant {
    Reader,
    Writer,
    Owner,
}

#[derive(Debug, Clone, Copy, Display, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)] // needed due to "Can" prefix
pub(super) enum StandardPrivilege {
    CanRead,
    CanShareRead,
    CanWrite,
    CanShareWrite,
    CanDelete,
    CanShareOwnership,
    CanRevoke,
}

macro_rules! impl_standard_privilege_from_into {
    ($ty:path) => {
        impl From<$ty> for StandardPrivilege {
            fn from(privilege: $ty) -> Self {
                match privilege {
                    <$ty>::CanRead => Self::CanRead,
                    <$ty>::CanShareRead => Self::CanShareRead,
                    <$ty>::CanWrite => Self::CanWrite,
                    <$ty>::CanShareWrite => Self::CanShareWrite,
                    <$ty>::CanDelete => Self::CanDelete,
                    <$ty>::CanShareOwnership => Self::CanShareOwnership,
                    <$ty>::CanRevoke => Self::CanRevoke,
                }
            }
        }

        impl From<StandardPrivilege> for $ty {
            fn from(privilege: StandardPrivilege) -> Self {
                match privilege {
                    StandardPrivilege::CanRead => Self::CanRead,
                    StandardPrivilege::CanShareRead => Self::CanShareRead,
                    StandardPrivilege::CanWrite => Self::CanWrite,
                    StandardPrivilege::CanShareWrite => Self::CanShareWrite,
                    StandardPrivilege::CanDelete => Self::CanDelete,
                    StandardPrivilege::CanShareOwnership => Self::CanShareOwnership,
                    StandardPrivilege::CanRevoke => Self::CanRevoke,
                }
            }
        }
    };
}

macro_rules! impl_standard_grant_from_into {
    ($ty:path) => {
        impl From<$ty> for StandardGrant {
            fn from(grant: $ty) -> Self {
                match grant {
                    <$ty>::Reader => Self::Reader,
                    <$ty>::Writer => Self::Writer,
                    <$ty>::Owner => Self::Owner,
                }
            }
        }

        impl From<StandardGrant> for $ty {
            fn from(grant: StandardGrant) -> Self {
                match grant {
                    StandardGrant::Reader => Self::Reader,
                    StandardGrant::Writer => Self::Writer,
                    StandardGrant::Owner => Self::Owner,
                }
            }
        }
    };
}

impl_standard_privilege_from_into!(RollingStockPrivilege);
impl_standard_privilege_from_into!(InfraPrivilege);
impl_standard_grant_from_into!(RollingStockGrant);
impl_standard_grant_from_into!(InfraGrant);
