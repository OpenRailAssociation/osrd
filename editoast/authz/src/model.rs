use serde::Deserialize;
use serde::Serialize;
use strum::AsRefStr;
use strum::Display;
use strum::EnumIter;
use strum::EnumString;
use utoipa::ToSchema;

#[derive(Debug, PartialEq, derive_more::From)]
pub enum Subject {
    User(User),
    Group(Group),
}

impl Subject {
    pub fn id(&self) -> i64 {
        match self {
            Subject::User(user) => user.0,
            Subject::Group(group) => group.0,
        }
    }

    pub(crate) async fn fetch<'a, T, E, Ureq, Greq>(
        &'a self,
        client: &fga::Client,
        u: impl FnOnce(&'a User) -> Ureq,
        g: impl FnOnce(&'a Group) -> Greq,
    ) -> Result<T, E>
    where
        Ureq: fga::client::Request<Response = T, Error = E>,
        Greq: fga::client::Request<Response = T, Error = E>,
    {
        match self {
            Subject::User(user) => u(user).fetch(client).await,
            Subject::Group(group) => g(group).fetch(client).await,
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
    fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, Clone, Copy, PartialEq, Eq, Hash,
)]
pub struct User(pub i64);

#[derive(
    fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, Clone, Copy, PartialEq, Eq, Hash,
)]
pub struct Group(pub i64);

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, Clone, Copy)]
pub struct Infra(pub i64);

#[derive(Debug, Clone, Copy, Display, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[allow(clippy::enum_variant_names)] // needed due to "Can" prefix
pub enum InfraPrivilege {
    CanRead,
    CanShareRead,
    CanWrite,
    CanShareWrite,
    CanDelete,
    CanShareOwnership,
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
    ToSchema,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum InfraGrant {
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
    ///
    /// Alternatively, especially for development, the `EDITOAST_ENABLE_AUTHORIZATION` environment variable can be set to `false`
    /// when no user identity header is present. (This is the case when editoast is queried directly and
    /// not through the gateway.)
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
        reader: User,
        writer:User,
        owner: User,
        // Computed
        can_read: User,
        can_write: User,
        can_delete: User,
        can_share_read: User,
        can_share_write: User,
        can_share_ownership: User
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
    ) -> Result<Vec<Self>, fga::client::RequestFailure>
    where
        O: fga::model::Object,
        R: fga::model::Relation<User = Self, Object = O>,
    {
        use fga::client::Request as _;

        let roles = relation
            .query_users(object)
            .fetch(openfga)
            .await
            .map_err(fga::client::QueryError::parsing_ok)?;
        debug_assert!(
            roles.public_access.is_none(),
            "we don't write public accesses for roles"
        );
        Ok(roles.users.into_iter().collect())
    }
}
