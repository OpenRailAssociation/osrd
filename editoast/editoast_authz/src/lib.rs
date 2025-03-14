mod authorizer;
mod model;
mod regulator;
mod role;
pub mod subject;

pub use authorizer::Authorizer;
pub use regulator::Regulator;
pub use regulator::StorageDriver;
pub use role::BuiltinRole;

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
            let model = fga::compile_model(AUTHORIZATION_MODEL);
            tracing::warn!(
                delta,
                "OpenFGA authorization model version is ahead of this release version --- pushing current model anyway"
            );
            client.update_authorization_model(&model).await?;
        }
    }
    Ok(())
}

/// An authorization error that can originate from either the OpenFGA client or the storage driver
#[derive(Debug, thiserror::Error)]
pub enum Error<StorageError: std::error::Error> {
    #[error("unknown subject {0}")]
    UnknownSubject(i64),
    #[error(transparent)]
    OpenFga(#[from] fga::client::RequestFailure),
    #[error(transparent)]
    Storage(StorageError),
}

#[cfg(test)]
/// The [fga::client::ConnectionSettings] to use for unit and doc tests
///
/// Configurable through the `OPENFGA_HOST` and `OPENFGA_PORT` environment variables.
/// Defaults to `localhost` and `8091`.
fn connection_settings() -> fga::client::ConnectionSettings {
    let address = std::env::var("OPENFGA_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = std::env::var("OPENFGA_PORT")
        .unwrap_or_else(|_| "8091".to_string())
        .parse()
        .expect("invalid port");
    fga::client::ConnectionSettings::new(address, port).reset_store()
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
