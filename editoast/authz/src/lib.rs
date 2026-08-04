mod authorizer;
pub mod identity;
mod model;
mod regulator;
pub mod v2;

pub use authorizer::Authorizer;
pub use regulator::Regulator;
pub use regulator::StorageDriver;

pub use model::Group;
pub use model::Infra;
pub use model::InfraGrant;
pub use model::InfraPrivilege;
pub use model::Project;
pub use model::ProjectGrant;
pub use model::ProjectPrivilege;
pub use model::Role;
pub use model::RollingStock;
pub use model::RollingStockGrant;
pub use model::RollingStockPrivilege;
pub use model::Subject;
pub use model::User;

/// An authorization error that can originate from either the OpenFGA client or the storage driver
#[derive(Debug, thiserror::Error)]
pub enum Error<StorageError: std::error::Error> {
    #[error("unknown subject {0}")]
    UnknownSubject(i64),
    #[error("unknown resource {0}")]
    UnknownResource(i64),
    #[error("unknown user {identity}")]
    UnknownUser { identity: String },
    #[error(transparent)]
    OpenFga(#[from] fga::client::Error),
    #[error(transparent)]
    Storage(StorageError),
}

/// A representation of an authorization decision over some resource
#[derive(derive_more::Debug, derive_more::Display)]
pub enum Authorization<T> {
    /// The initiator of the authorization is allowed to access the resource
    Granted(T),
    /// The initiator of the authorization is an admin and bypassed the authorization checks
    Bypassed,
    /// The initiator of the authorization is denied access to the resource
    Denied { reason: &'static str },
}

#[derive(Debug, thiserror::Error)]
#[error("Unauthorized (reason: {reason})")]
pub struct Unauthorized {
    pub reason: &'static str,
}

impl Authorization<()> {
    pub fn allowed(self) -> Result<(), Unauthorized> {
        match self {
            Authorization::Granted(()) | Authorization::Bypassed => Ok(()),
            Authorization::Denied { reason } => Err(Unauthorized { reason }),
        }
    }

    pub async fn allowed_then_try<U, E>(
        self,
        f: impl AsyncFnOnce() -> Result<Authorization<U>, E>,
    ) -> Result<Authorization<U>, E> {
        match self {
            Authorization::Granted(()) => f().await,
            Authorization::Bypassed => f().await,
            Authorization::Denied { reason } => Ok(Authorization::Denied { reason }),
        }
    }
}

impl<T> Authorization<T> {
    pub fn denied(&self) -> bool {
        matches!(self, Self::Denied { .. })
    }
}

impl<T: std::fmt::Debug> Authorization<T> {
    #[track_caller]
    pub fn expect_allowed(self, reason: &'static str) -> T {
        match self {
            Authorization::Granted(value) => value,
            other => panic!("expected Authorization::Granted, got {other:?}: {reason}"),
        }
    }

    #[track_caller]
    pub fn expect_denied(self, reason: &'static str) -> &'static str {
        match self {
            Authorization::Denied { reason } => reason,
            other => panic!("expected Authorization::Denied, got {other:?}: {reason}"),
        }
    }
}

impl<T: Default> Authorization<T> {
    #[inline]
    fn from_privilege_check(allowed: bool) -> Self {
        if allowed {
            Authorization::Granted(T::default())
        } else {
            Authorization::Denied {
                reason: "insufficient privileges",
            }
        }
    }
}

#[cfg(test)]
macro_rules! authz_client {
    () => {{
        let client_authz = fga::test_client!("authz@");
        let client_migrations = fga::test_client!("migrations@");
        fga_migrations::run_migrations(
            client_authz.clone(),
            client_migrations,
            fga_migrations::TargetMigration::Latest,
        )
        .await
        .expect("Failed to initialize/update the authorization model");
        client_authz
    }};
}

#[cfg(test)]
use authz_client;
