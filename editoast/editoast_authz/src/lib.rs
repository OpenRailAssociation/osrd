pub mod authorizer;
pub mod builtin_role;
pub mod roles;

pub use builtin_role::BuiltinRole;
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

#[cfg(any(test, feature = "fixtures"))]
pub mod fixtures {
    use strum::AsRefStr;
    use strum::EnumString;

    use crate::roles::BuiltinRoleSet;

    #[derive(Debug, Clone, PartialEq, Eq, Hash, AsRefStr, EnumString)]
    #[strum(serialize_all = "snake_case")]
    pub enum TestBuiltinRole {
        DocRead,
        DocEdit,
        DocDelete,
        UserAdd,
        UserBan,
        Superuser,
    }

    impl BuiltinRoleSet for TestBuiltinRole {
        fn superuser() -> Self {
            Self::Superuser
        }
    }
}
