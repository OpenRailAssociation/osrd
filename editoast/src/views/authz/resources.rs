use authz::InfraGrant;
use authz::InfraPrivilege;
use authz::RollingStockGrant;
use authz::RollingStockPrivilege;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::views::authz::ResourceType;

pub(super) trait ViewResource {
    // Privileges only exist in responses.
    type Privilege: Into<StandardPrivilege>;
    // But grants are in both requests and responses.
    type Grant: From<StandardGrant> + Into<StandardGrant>;

    fn id(&self) -> i64;
    fn resource_type(&self) -> ResourceType;
}

impl ViewResource for authz::Infra {
    type Privilege = InfraPrivilege;
    type Grant = InfraGrant;

    fn id(&self) -> i64 {
        **self
    }

    fn resource_type(&self) -> ResourceType {
        ResourceType::Infra
    }
}

impl ViewResource for authz::RollingStock {
    type Privilege = RollingStockPrivilege;
    type Grant = RollingStockGrant;

    fn id(&self) -> i64 {
        **self
    }

    fn resource_type(&self) -> ResourceType {
        ResourceType::RollingStock
    }
}

pub enum Resource {
    Infra(authz::Infra),
    RollingStock(authz::RollingStock),
}

impl ViewResource for Resource {
    type Privilege = StandardPrivilege;
    type Grant = StandardGrant;

    fn id(&self) -> i64 {
        match self {
            Resource::Infra(authz::Infra(id)) => *id,
            Resource::RollingStock(authz::RollingStock(id)) => *id,
        }
    }

    fn resource_type(&self) -> ResourceType {
        match self {
            Resource::Infra(_) => ResourceType::Infra,
            Resource::RollingStock(_) => ResourceType::RollingStock,
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(test, derive(Debug, PartialEq))]
pub(super) enum StandardGrant {
    RestrictedReader,
    Reader,
    Writer,
    Owner,
}

#[derive(Debug, Clone, Copy, Display, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)] // needed due to "Can" prefix
pub(super) enum StandardPrivilege {
    CanRestrictedRead,
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
                    <$ty>::CanRestrictedRead => Self::CanRestrictedRead,
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
                    StandardPrivilege::CanRestrictedRead => Self::CanRestrictedRead,
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
                    <$ty>::RestrictedReader => Self::RestrictedReader,
                    <$ty>::Reader => Self::Reader,
                    <$ty>::Writer => Self::Writer,
                    <$ty>::Owner => Self::Owner,
                }
            }
        }

        impl From<StandardGrant> for $ty {
            fn from(grant: StandardGrant) -> Self {
                match grant {
                    StandardGrant::RestrictedReader => Self::RestrictedReader,
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
