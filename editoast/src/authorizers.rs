use std::convert::Infallible;

use authz::InfraPrivilege;
use authz::RollingStockPrivilege;
use authz::v2::Access;
use authz::v2::Authorizer;
use authz::v2::Guardrail;
use authz::v2::Protected;
use authz::v2::SanityCheck;
use editoast_models::prelude::*;

/// An authorizer that represents editoast's authorization decisions
///
/// Decorrelated from any user, this authorizer is used for actions that the
/// system knows are correct. For example, attributing the first owner of a new resource.
///
/// No user can be associated with this authorizer.
pub struct SystemAuthorizer<'a> {
    pub openfga: &'a fga::Client,
    pub conn: database::DbConnection,
}

impl Authorizer for SystemAuthorizer<'_> {
    type Error = editoast_models::Error;
    type Rejection = Rejection;

    #[tracing::instrument(skip_all)]
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        let conn = &mut self.conn.clone();
        for check in &data.sanity_checks {
            if let Some(rejection) = sanity_check(check, conn).await? {
                return Ok(Access::Denied { rejection });
            }
        }
        Ok(data.access_authorized(self.openfga))
    }
}

pub struct UserAuthorizer<'c> {
    pub user: authz::User,
    pub roles: Vec<authz::Role>, // TODO: use a SmallVec
    pub openfga: &'c fga::Client,
    pub conn: database::DbConnection,
}

impl<'c> UserAuthorizer<'c> {
    pub fn new(
        user: authz::User,
        roles: Vec<authz::Role>,
        openfga: &'c fga::Client,
        conn: database::DbConnection,
    ) -> Self {
        Self {
            user,
            roles,
            openfga,
            conn,
        }
    }
}

impl Authorizer for UserAuthorizer<'_> {
    type Error = Error;
    type Rejection = Rejection;

    #[tracing::instrument(skip_all)]
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        let conn = &mut self.conn.clone();
        for check in &data.sanity_checks {
            if let Some(rejection) = sanity_check(check, conn).await? {
                return Ok(Access::Denied { rejection });
            }
        }
        if !self.roles.contains(&authz::Role::Admin) {
            for gr in &data.guardrails {
                if let Some(rejection) =
                    guardrail(gr, &self.user, &self.roles, self.openfga).await?
                {
                    return Ok(Access::Denied { rejection });
                }
            }
        }
        Ok(data.access_authorized(self.openfga))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Database(#[from] editoast_models::Error),
    #[error(transparent)]
    OpenFga(#[from] authz::v2::OpenFgaError),
}

#[derive(Debug)]
#[non_exhaustive]
pub enum Rejection {
    // Sanity check rejections
    NoSuchUser(i64),
    NoSuchGroup(#[expect(dead_code)] i64),
    NoSuchInfra(i64),
    NoSuchRollingStock(#[expect(dead_code)] i64),

    // Guardrail rejections
    LackingRole(
        #[expect(dead_code)] authz::Subject,
        #[expect(dead_code)] authz::Role,
    ),
    LackingInfraPrivilege(
        InfraPrivilege,
        #[expect(dead_code)] authz::Subject,
        authz::Infra,
    ),
    LackingRollingStockPrivilege(
        #[expect(dead_code)] RollingStockPrivilege,
        #[expect(dead_code)] authz::Subject,
        #[expect(dead_code)] authz::RollingStock,
    ),
}

/// Wraps [`unreachable!`] with a message specific to impossible rejections
macro_rules! impossible {
    ($rejection:expr) => {
        unreachable!(
            "impossible rejection {:?} — if this occurs, some authz::Protected check rejection has been overlooked", $rejection
        )
    };
}
pub(crate) use impossible;

#[tracing::instrument(skip_all, fields(?sanity_check), ret(level = "trace"), err)]
async fn sanity_check(
    sanity_check: &SanityCheck,
    conn: &mut database::DbConnection,
) -> Result<Option<Rejection>, editoast_models::Error> {
    match sanity_check {
        SanityCheck::SubjectExists(authz::Subject::User(authz::User(user_id))) => {
            Ok((!editoast_models::User::exists(conn, *user_id).await?)
                .then_some(Rejection::NoSuchUser(*user_id)))
        }
        SanityCheck::SubjectExists(authz::Subject::Group(authz::Group(group_id))) => {
            Ok((!editoast_models::Group::exists(conn, *group_id).await?)
                .then_some(Rejection::NoSuchGroup(*group_id)))
        }
        SanityCheck::InfraExists(authz::Infra(infra_id)) => {
            Ok((!editoast_models::Infra::exists(conn, *infra_id).await?)
                .then_some(Rejection::NoSuchInfra(*infra_id)))
        }
        SanityCheck::RollingStockExists(authz::RollingStock(rolling_stock_id)) => Ok(
            (!editoast_models::RollingStock::exists(conn, *rolling_stock_id).await?)
                .then_some(Rejection::NoSuchRollingStock(*rolling_stock_id)),
        ),
    }
}

#[tracing::instrument(skip_all, fields(?guardrail, ?issuer, ?roles), ret(level = "trace"), err)]
async fn guardrail(
    guardrail: &Guardrail,
    issuer: &authz::User,
    roles: &[authz::Role],
    openfga: &fga::Client,
) -> Result<Option<Rejection>, authz::v2::OpenFgaError> {
    Ok(match guardrail {
        Guardrail::IssuerHasRole(role) if !roles.contains(role) => {
            Some(Rejection::LackingRole(authz::Subject::user(*issuer), *role))
        }
        Guardrail::IssuerHasRole(_) => None,

        Guardrail::IssuerHasInfraPrivilege(privilege, infra) => {
            let Ok(privileges) = authz::v2::infra_privileges(*issuer, *infra)
                .access_authorized::<Infallible>(openfga)
                .access()
                .await?;
            (!privileges.contains(privilege)).then_some(Rejection::LackingInfraPrivilege(
                *privilege,
                authz::Subject::user(*issuer),
                *infra,
            ))
        }

        Guardrail::IssuerHasRollingStockPrivilege(privilege, rolling_stock) => {
            let Ok(privileges) =
                authz::v2::rolling_stock::rolling_stock_privileges(*issuer, *rolling_stock)
                    .access_authorized::<Infallible>(openfga)
                    .access()
                    .await?;
            (!privileges.contains(privilege)).then_some(Rejection::LackingRollingStockPrivilege(
                *privilege,
                authz::Subject::user(*issuer),
                *rolling_stock,
            ))
        }
    })
}
