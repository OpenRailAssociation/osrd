use std::convert::Infallible;

use authz::v2::Access;
use authz::v2::Actor;
use authz::v2::Authorizer;
use authz::v2::Check;
use authz::v2::Protected;
use editoast_models::prelude::*;
use futures::FutureExt as _;
use futures::StreamExt as _;
use futures::TryFutureExt as _;
use futures::stream::FuturesUnordered;
use tracing::Instrument as _;

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

impl SystemAuthorizer<'_> {
    #[tracing::instrument(target = "SystemAuthorizer::check", skip_all, fields(?check), ret(level = "trace"), err)]
    async fn check<'ch>(
        &self,
        check: &'ch Check,
    ) -> Result<Option<&'ch Check>, editoast_models::Error> {
        let conn = &mut self.conn.clone();
        Ok(match check {
            Check::SubjectExists(authz::Subject::User(user)) => {
                (!editoast_models::User::exists(conn, **user).await?).then_some(check)
            }
            Check::SubjectExists(authz::Subject::Group(group)) => {
                (!editoast_models::Group::exists(conn, **group).await?).then_some(check)
            }
            Check::InfraExists(infra) => {
                (!editoast_models::Infra::exists(conn, **infra).await?).then_some(check)
            }
            // checked by UserAuthorizer
            Check::HasRole(..) | Check::HasInfraPrivilege(..) => None,
        })
    }
}

impl Authorizer for SystemAuthorizer<'_> {
    type Rejection = Check;
    type Error = editoast_models::Error;

    #[tracing::instrument(skip_all)]
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        {
            // scoping to tell the borrow checker that checks is consumed before returning
            // access_authorized which takes ownership of data
            let mut checks = data
                .checks
                .iter()
                .map(|check| self.check(check).in_current_span())
                .collect::<FuturesUnordered<_>>();
            while let Some(result) = checks.next().await {
                if let Some(check) = result? {
                    return Ok(Access::Denied { rejection: *check });
                }
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

    fn actor_user<'a>(&'a self, actor: &'a Actor) -> &'a authz::User {
        match actor {
            Actor::Issuer => &self.user,
            Actor::User(user) => user,
        }
    }

    #[tracing::instrument(target = "UserAutorizer::check", skip_all, fields(?check, issuer = ?self.user, roles = ?self.roles), ret(level = "trace"), err)]
    async fn check<'ch>(
        &self,
        check: &'ch Check,
    ) -> Result<Option<&'ch Check>, authz::v2::OpenFgaError> {
        Ok(match check {
            Check::HasRole(Actor::Issuer, role) if !self.roles.contains(role) => Some(check),
            Check::HasRole(Actor::Issuer, _) => None,
            Check::HasRole(Actor::User(user), role) => {
                let Ok(roles) = authz::v2::subject_roles(authz::Subject::User(*user))
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!roles.contains(role)).then_some(check)
            }

            Check::HasInfraPrivilege(actor, privilege, infra) => {
                let Ok(privileges) = authz::v2::infra_privileges(*self.actor_user(actor), *infra)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!privileges.contains(privilege)).then_some(check)
            }
            // checked by SystemAuthorizer
            Check::SubjectExists(_) | Check::InfraExists(_) => None,
        })
    }
}

impl Authorizer for UserAuthorizer<'_> {
    type Rejection = Check;
    type Error = Error;

    #[tracing::instrument(skip_all)]
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        let system_authorizer = SystemAuthorizer {
            openfga: self.openfga,
            conn: self.conn.clone(),
        };
        {
            // scoping to tell the borrow checker that checks is consumed before returning
            // access_authorized which takes ownership of data
            // same thing for the system_authorizer
            let mut checks = FuturesUnordered::new();
            for check in &data.checks {
                checks.push(
                    system_authorizer
                        .check(check)
                        .map_err(Self::Error::from)
                        .in_current_span()
                        .boxed(),
                );
            }
            if !self.roles.contains(&authz::Role::Admin) {
                for check in &data.checks {
                    checks.push(
                        self.check(check)
                            .map_err(Self::Error::from)
                            .in_current_span()
                            .boxed(),
                    );
                }
            }
            while let Some(result) = checks.next().await {
                if let Some(check) = result? {
                    return Ok(Access::Denied { rejection: *check });
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

/// Wraps [`unreachable!`] with a message specific to impossible checks
macro_rules! impossible {
    ($check:expr) => {
        unreachable!(
            "impossible check {:?} — if this occurs, some authz::Protected check handling has been overlooked", $check
        )
    };
}
pub(crate) use impossible;
