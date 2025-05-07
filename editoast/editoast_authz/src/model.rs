use serde::Deserialize;
use serde::Serialize;
use strum::AsRefStr;
use strum::Display;
use strum::EnumIter;
use strum::EnumString;
use utoipa::ToSchema;

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, PartialEq, Eq, Hash)]
pub struct User(pub i64);

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, PartialEq, Eq, Hash)]
pub struct Group(pub i64);

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug)]
pub(crate) struct Infra(pub(crate) String);

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
