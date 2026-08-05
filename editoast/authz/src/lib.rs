pub mod identity;
mod model;
pub mod v2;

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
