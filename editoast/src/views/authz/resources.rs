use std::collections::HashMap;
use std::collections::HashSet;

use authz::InfraGrant;
use authz::InfraPrivilege;
use authz::RollingStockGrant;
use authz::RollingStockPrivilege;
use authz::v2;
use authz::v2::Protected;
use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use tracing::Instrument as _;
use utoipa::ToSchema;

use crate::views::authz::ResourceType;

pub(super) trait ViewResource {
    // Privileges only exist in responses.
    type Privilege: Into<StandardPrivilege>;
    // But grants are in both requests and responses.
    type Grant: From<StandardGrant> + Into<StandardGrant>;

    fn id(&self) -> i64;
    fn resource_type(&self) -> ResourceType;

    fn privileges(&self, user: authz::User) -> Protected<HashSet<Self::Privilege>>;
    fn granted_subjects(&self, grant: Self::Grant) -> Protected<Vec<authz::Subject>>;
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

    fn privileges(&self, user: authz::User) -> Protected<HashSet<Self::Privilege>> {
        v2::infra_privileges(user, *self)
    }

    fn granted_subjects(&self, grant: Self::Grant) -> Protected<Vec<authz::Subject>> {
        v2::infra_granted_subjects(*self, grant)
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

    fn privileges(&self, user: authz::User) -> Protected<HashSet<Self::Privilege>> {
        v2::rolling_stock_privileges(user, *self)
    }

    fn granted_subjects(&self, grant: Self::Grant) -> Protected<Vec<authz::Subject>> {
        v2::rolling_stock_granted_subjects(*self, grant)
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

    fn privileges(&self, user: authz::User) -> Protected<HashSet<Self::Privilege>> {
        match self {
            Resource::Infra(infra) => infra
                .privileges(user)
                .map(async |p| p.into_iter().map_into().collect()),
            Resource::RollingStock(rolling_stock) => rolling_stock
                .privileges(user)
                .map(async |p| p.into_iter().map_into().collect()),
        }
    }

    fn granted_subjects(&self, grant: Self::Grant) -> Protected<Vec<authz::Subject>> {
        match self {
            Resource::Infra(infra) => infra.granted_subjects(grant.into()),
            Resource::RollingStock(rolling_stock) => rolling_stock.granted_subjects(grant.into()),
        }
    }
}

impl Resource {
    pub(super) fn new(rtype: ResourceType, id: i64) -> Self {
        match rtype {
            ResourceType::Infra => Resource::Infra(authz::Infra(id)),
            ResourceType::RollingStock => Resource::RollingStock(authz::RollingStock(id)),
        }
    }

    pub(super) fn extract_from_check(check: v2::Check) -> Option<Self> {
        match check {
            v2::Check::HasInfraPrivilege(_, _, infra)
            | v2::Check::CanAlterSubjectInfraGrant(_, infra, _)
            | v2::Check::SubjectEffectiveInfraGrantIsNot(_, _, infra)
            | v2::Check::IsNotLastInfraOwner(_, infra) => Some(Self::Infra(infra)),

            v2::Check::HasRollingStockPrivilege(_, _, rolling_stock)
            | v2::Check::CanAlterSubjectRollingStockGrant(_, rolling_stock, _)
            | v2::Check::SubjectEffectiveRollingStockGrantIsNot(_, _, rolling_stock)
            | v2::Check::IsNotLastRollingStockOwner(_, rolling_stock) => {
                Some(Self::RollingStock(rolling_stock))
            }

            v2::Check::HasProjectPrivilege(_, _, _project)
            | v2::Check::CanGiveSubjectProjectGrant(_, _project) => todo!(),
            v2::Check::HasRole(_, _) => None,
        }
    }
}

pub(super) type MissingResources = HashMap<ResourceType, HashSet<i64>>;

#[tracing::instrument(skip_all, err)]
pub(super) async fn fetch_resources(
    mut conn: database::DbConnection,
    mut ids: HashMap<ResourceType, Vec<i64>>,
) -> Result<(Vec<Resource>, MissingResources), models::Error> {
    use models::prelude::*;

    let mut rs_conn = conn.clone();
    let ((infras, missing_infras), (rolling_stocks, missing_rolling_stocks)) = tokio::try_join!(
        models::Infra::retrieve_batch::<_, Vec<_>>(
            &mut conn,
            ids.remove(&ResourceType::Infra).unwrap_or_default()
        )
        .in_current_span(),
        models::RollingStock::retrieve_batch::<_, Vec<_>>(
            &mut rs_conn,
            ids.remove(&ResourceType::RollingStock).unwrap_or_default()
        )
        .in_current_span(),
    )?;
    debug_assert!(ids.is_empty(), "some resource type has been overlooked");

    let found = infras
        .into_iter()
        .map(|res| Resource::new(ResourceType::Infra, res.id))
        .chain(
            rolling_stocks
                .into_iter()
                .map(|res| Resource::new(ResourceType::RollingStock, res.id)),
        )
        .collect::<Vec<_>>();
    let mut missing = HashMap::new();
    missing.extend((!missing_infras.is_empty()).then_some((ResourceType::Infra, missing_infras)));
    missing.extend(
        (!missing_rolling_stocks.is_empty())
            .then_some((ResourceType::RollingStock, missing_rolling_stocks)),
    );
    Ok((found, missing))
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
