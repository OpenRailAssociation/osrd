use serde::Deserialize;
use serde::Serialize;
use strum::AsRefStr;
use strum::Display;
use strum::EnumIter;
use strum::EnumString;
use utoipa::ToSchema;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    derive_more::Display,
    derive_more::From,
)]
pub enum Subject {
    User(User),
    Group(Group),
}

impl Subject {
    pub fn user(user: impl Into<User>) -> Self {
        Subject::User(user.into())
    }

    pub fn group(group: impl Into<Group>) -> Self {
        Subject::Group(group.into())
    }

    pub fn id(&self) -> i64 {
        match self {
            Subject::User(user) => user.0,
            Subject::Group(group) => group.0,
        }
    }
}

#[cfg(test)]
impl AsRef<User> for Subject {
    fn as_ref(&self) -> &User {
        match self {
            Subject::User(user) => user,
            Subject::Group(_) => unreachable!("tests should make sure the subject is a user"),
        }
    }
}

#[cfg(test)]
impl AsRef<Group> for Subject {
    fn as_ref(&self) -> &Group {
        match self {
            Subject::User(_) => unreachable!("tests should make sure the subject is a group"),
            Subject::Group(group) => group,
        }
    }
}

#[derive(
    fga::Type,
    fga::User,
    fga::Object,
    derive_more::Display,
    derive_more::From,
    derive_more::FromStr,
    derive_more::Deref,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
)]
pub struct User(pub i64);

#[derive(
    fga::Type,
    fga::User,
    fga::Object,
    derive_more::Display,
    derive_more::From,
    derive_more::FromStr,
    derive_more::Deref,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
)]
pub struct Group(pub i64);

#[derive(
    Debug, Clone, Copy, Display, PartialEq, Eq, Hash, strum::VariantArray, Serialize, Deserialize,
)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)] // needed due to "Can" prefix
pub enum InfraPrivilege {
    CanRestrictedRead,
    CanRead,
    CanShareRead,
    CanWrite,
    CanShareWrite,
    CanDelete,
    CanShareOwnership,
    CanRevoke,
}

#[derive(
    Debug, Display, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum InfraGrant {
    RestrictedReader,
    Reader,
    Writer,
    Owner,
}

#[derive(
    fga::Type,
    fga::User,
    fga::Object,
    derive_more::Display,
    derive_more::From,
    derive_more::FromStr,
    derive_more::Deref,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
)]
#[cfg_attr(test, derive(PartialOrd, Ord))]
#[fga(name = "rolling_stock")]
pub struct RollingStock(pub i64);

#[derive(
    fga::Type,
    fga::User,
    fga::Object,
    derive_more::Display,
    derive_more::From,
    derive_more::FromStr,
    derive_more::Deref,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
)]
#[cfg_attr(test, derive(PartialOrd, Ord))]
pub struct Infra(pub i64);

#[derive(
    Debug, Clone, Copy, Display, PartialEq, Eq, Hash, strum::VariantArray, Serialize, Deserialize,
)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)]
pub enum RollingStockPrivilege {
    CanRestrictedRead,
    CanRead,
    CanShareRead,
    CanWrite,
    CanShareWrite,
    CanDelete,
    CanShareOwnership,
    CanRevoke,
}

#[derive(
    Debug,
    Display,
    Clone,
    Copy,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    Serialize,
    Deserialize,
    EnumIter,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum RollingStockGrant {
    RestrictedReader,
    Reader,
    Writer,
    Owner,
}

#[derive(
    fga::User,
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    Serialize,
    Deserialize,
    EnumString,
    AsRefStr,
    EnumIter,
    Display,
    ToSchema,
)]
pub enum Role {
    /// A user with this role short-circuits all role and permission checks
    Admin,
    Stdcm,
    OperationalStudies,
}

impl fga::model::Type for Role {
    const NAMESPACE: &'static str = "role";

    fn id(&self) -> impl ToString {
        self.as_ref()
    }
}

#[derive(fga::Type, fga::Object, derive_more::FromStr, Clone, Copy, Debug, Eq, Hash, PartialEq)]
#[cfg_attr(test, derive(Ord, PartialOrd))]
pub struct Project(pub i64);

#[derive(Clone, Copy, Debug, EnumString, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum ProjectPrivilege {
    HasAccess,
}

#[derive(EnumString, Serialize)]
#[cfg_attr(test, derive(Debug, PartialEq))]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ProjectGrant {
    Owner,
}

fga::relations! {
    User {
        role: Role,
        group: Group
    },
    Group {
        role: Role,
        member: User
    },
    Infra {
        restricted_reader: User,
        reader: User,
        writer:User,
        owner: User,
        // Computed
        can_restricted_read: User,
        can_read: User,
        can_write: User,
        can_delete: User,
        can_share_read: User,
        can_share_write: User,
        can_share_ownership: User,
        can_revoke: User
    },
    RollingStock {
        restricted_reader: User,
        reader: User,
        writer: User,
        owner: User,
        // Computed
        can_restricted_read: User,
        can_read: User,
        can_write: User,
        can_delete: User,
        can_share_read: User,
        can_share_write: User,
        can_share_ownership: User,
        can_revoke: User
    },
    Project {
        owner: User,
        // Computed
        has_access: User
    }
}

impl Role {
    pub fn as_str(&self) -> &str {
        self.as_ref()
    }

    pub(crate) async fn list_roles<O, R>(
        openfga: &fga::Client,
        relation: R,
        object: &R::Object,
    ) -> Result<Vec<Self>, fga::client::Error>
    where
        O: fga::model::Object,
        R: fga::model::Relation<User = Self, Object = O>,
    {
        use fga::client::Request as _;

        let roles = relation.query_users(object).fetch(openfga).await?;
        debug_assert!(
            roles.public_access.is_none(),
            "we don't write public accesses for roles"
        );
        Ok(roles.users)
    }
}
