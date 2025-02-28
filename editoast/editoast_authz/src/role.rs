use std::str::FromStr;

use fga::client::Request as _;
use fga::model::Object;
use fga::model::Relation;
use serde::Deserialize;
use serde::Serialize;
use strum::AsRefStr;
use strum::Display;
use strum::EnumIter;
use strum::EnumString;
use utoipa::ToSchema;

use crate::model::Role;

// TODO: rename to Role
#[derive(
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
pub enum BuiltinRole {
    /// A user with this role short-circuits all role and permission checks
    ///
    /// Alternatively, especially for development, the `EDITOAST_ENABLE_AUTHORIZATION` environment variable can be set to `false`
    /// when no user identity header is present. (This is the case when editoast is queried directly and
    /// not through the gateway.)
    Admin,
    Stdcm,
    OperationalStudies,
}

impl BuiltinRole {
    pub fn as_str(&self) -> &str {
        self.as_ref()
    }

    // TODO: try to make BuiltinRole an OpenFGA Type with a custom parsing step
    pub(crate) async fn list_roles<O: Object, R: Relation<User = Role, Object = O>>(
        openfga: &fga::Client,
        relation: R,
        object: &R::Object,
    ) -> Result<Vec<Self>, fga::client::RequestFailure> {
        let roles = relation.query_users(object).fetch(openfga).await?;
        debug_assert!(
            roles.public_access.is_none(),
            "we don't write public accesses for roles"
        );
        let roles = roles
            .users
            .into_iter()
            .filter_map(|Role(role)| match Self::from_str(&role) {
                Ok(role) => Some(role),
                Err(_) => {
                    tracing::error!(role, "unknown role found — skipping it");
                    None
                }
            })
            .collect();
        Ok(roles)
    }
}

impl From<BuiltinRole> for Role {
    fn from(value: BuiltinRole) -> Self {
        Role::from(value.as_ref().to_string())
    }
}
