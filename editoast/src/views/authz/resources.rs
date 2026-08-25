use authz::InfraGrant;
use authz::InfraPrivilege;
use authz::ProjectGrant;
use authz::ProjectPrivilege;
use authz::RollingStockGrant;
use authz::RollingStockPrivilege;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::views::authz::ResourceType;

pub enum Resource {
    Infra(authz::Infra),
    RollingStock(authz::RollingStock),
    Project(authz::Project),
}

/// Error returned when a [`StandardGrant`] cannot be converted to a resource-specific grant.
///
/// Keeps the rejected grant available so endpoints can turn it into the appropriate API error.
pub(super) struct IncompatibleGrant(pub(super) StandardGrant);

impl Resource {
    pub(super) fn id(&self) -> i64 {
        match self {
            Resource::Infra(authz::Infra(id)) => *id,
            Resource::RollingStock(authz::RollingStock(id)) => *id,
            Resource::Project(authz::Project(id)) => *id,
        }
    }
    pub(super) fn get_type(&self) -> ResourceType {
        match self {
            Resource::Infra(_) => ResourceType::Infra,
            Resource::RollingStock(_) => ResourceType::RollingStock,
            Resource::Project(_) => ResourceType::Project,
        }
    }
}

#[derive(
    Clone, Copy, Serialize, Deserialize, ToSchema, Debug, Display, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
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
    HasAccess,
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
impl From<ProjectPrivilege> for StandardPrivilege {
    fn from(privilege: ProjectPrivilege) -> Self {
        match privilege {
            ProjectPrivilege::HasAccess => Self::HasAccess,
        }
    }
}
impl_standard_grant_from_into!(RollingStockGrant);
impl_standard_grant_from_into!(InfraGrant);
impl From<ProjectGrant> for StandardGrant {
    fn from(grant: ProjectGrant) -> Self {
        match grant {
            ProjectGrant::Owner => Self::Owner,
        }
    }
}

impl TryFrom<StandardGrant> for ProjectGrant {
    type Error = IncompatibleGrant;

    fn try_from(grant: StandardGrant) -> Result<Self, Self::Error> {
        match grant {
            StandardGrant::Owner => Ok(Self::Owner),
            StandardGrant::RestrictedReader | StandardGrant::Reader | StandardGrant::Writer => {
                Err(IncompatibleGrant(grant))
            }
        }
    }
}
