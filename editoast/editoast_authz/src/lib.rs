mod authorizer;
mod model;
mod regulator;
pub mod subject;

pub use authorizer::Authorizer;
pub use regulator::Regulator;
pub use regulator::StorageDriver;

pub use model::Group;
pub use model::Infra;
pub use model::InfraPrivilege;
pub use model::Role;
pub use model::User;

use futures::TryStreamExt;

pub const AUTHORIZATION_MODEL: &str = include_str!("../authorization_model.fga");

// big hack
const MODEL_VERSION: i64 = 1;

pub async fn ensure_latest_authorization_model(
    client: &mut fga::Client,
) -> Result<(), fga::client::RequestFailure> {
    let uploaded_models = client
        .authorization_models()
        .try_fold(0i64, |i, _| async move { Ok(i + 1) })
        .await?;
    match MODEL_VERSION - uploaded_models {
        0 => tracing::debug!("OpenFGA authorization model is up to date"),
        delta if delta > 0 => {
            let model = fga::compile_model(AUTHORIZATION_MODEL);
            tracing::info!("uploading OpenFGA authorization model");
            client.update_authorization_model(&model).await?;
        }
        delta => {
            // This can happen if multiple pods are spawned simultaneously resulting
            // in a race condition where multiple models are uploaded at the same time.
            tracing::error!(
                delta,
                "OpenFGA authorization model version is ahead of the release version.\n\
                Using the latest uploaded model. Expect wrong behavior.\n\
                This will be fixed eventually when a migration system is set up."
            );
        }
    }
    Ok(())
}

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
    OpenFga(#[from] fga::client::RequestFailure),
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
/// The [fga::client::ConnectionSettings] to use for unit and doc tests
///
/// Configurable through the `OPENFGA_HOST`, `OPENFGA_PORT`, `OPENFGA_MAX_CHECKS_PER_BATCH_CHECK` and
/// `OPENFGA_MAX_TUPLES_PER_WRITE` environment variables.
/// Defaults to `localhost`, `8091` and OpenFGA default limits.
fn connection_settings() -> fga::client::ConnectionSettings {
    use fga::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
    use fga::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
    use fga::client::Limits;

    let address = std::env::var("OPENFGA_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = std::env::var("OPENFGA_PORT")
        .unwrap_or_else(|_| "8091".to_string())
        .parse()
        .expect("invalid port");
    let max_checks_per_batch_check = std::env::var("OPENFGA_MAX_CHECKS_PER_BATCH_CHECK")
        .map(|tuple_reads| tuple_reads.parse::<u32>().expect("invalid max tuple reads"))
        .unwrap_or(DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK);
    let max_tuples_per_write = std::env::var("OPENFGA_MAX_TUPLES_PER_WRITE")
        .map(|tuple_writes| {
            tuple_writes
                .parse::<u64>()
                .expect("invalid max tuple reads")
        })
        .unwrap_or(DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE);
    let limits = Limits {
        max_checks_per_batch_check,
        max_tuples_per_write,
    };
    fga::client::ConnectionSettings::new(address, port, limits).reset_store()
}

#[cfg(test)]
macro_rules! openfga {
    () => {{
        let mut client = fga::Client::try_new_store(
            stdext::function_name!()
                .split("::")
                .filter(|x| *x != "{{closure}}")
                .collect::<Vec<_>>()
                .join("-"),
            crate::connection_settings(),
        )
        .await
        .expect("Failed to initialize client");
        crate::ensure_latest_authorization_model(&mut client)
            .await
            .expect("Failed to initialize/update the authorization model");
        client
    }};
}

#[cfg(test)]
use openfga;
