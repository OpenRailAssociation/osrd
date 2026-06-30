use std::convert::Infallible;

use authz::v2::Access;
use authz::v2::Actor;
use authz::v2::Authorizer;
use authz::v2::Check;
use authz::v2::Protected;
use editoast_models::prelude::*;
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
    async fn check(&self, check: Check) -> Result<Option<Check>, Error> {
        let conn = &mut self.conn.clone();
        Ok(match check {
            Check::SubjectExists(authz::Subject::User(user)) => {
                (!editoast_models::User::exists(conn, *user).await?).then_some(check)
            }
            Check::SubjectExists(authz::Subject::Group(group)) => {
                (!editoast_models::Group::exists(conn, *group).await?).then_some(check)
            }
            Check::InfraExists(infra) => {
                (!editoast_models::Infra::exists(conn, *infra).await?).then_some(check)
            }
            Check::RollingStockExists(authz::RollingStock(rolling_stock_id)) => {
                (!editoast_models::RollingStock::exists(conn, rolling_stock_id).await?)
                    .then_some(check)
            }
            // checked by UserAuthorizer
            Check::HasRole(..)
            | Check::HasInfraPrivilege(..)
            | Check::HasRollingStockPrivilege(..)
            | Check::SubjectEffectiveInfraGrantIsNot(..)
            | Check::IsNotLastInfraOwner(..) => None,
        })
    }
}

impl Authorizer for SystemAuthorizer<'_> {
    type Rejection = Check;
    type Error = Error;

    #[tracing::instrument(skip_all)]
    fn run_checks<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> impl futures::stream::TryStream<
        Ok = itertools::Either<Self::Rejection, Access<'a, T, Infallible>>,
        Error = Self::Error,
    > {
        use futures::stream;
        use futures::stream::StreamExt as _;
        use futures::stream::TryStreamExt as _;
        let (checks, access) = data.unpack(self.openfga);
        let checks = checks
            .into_iter()
            .map(|check| self.check(check).in_current_span())
            .collect::<FuturesUnordered<_>>();
        checks
            .try_filter_map(async |check| Ok(check.map(itertools::Either::Left))) // filter out passing checks
            .chain(stream::iter(vec![Ok(itertools::Either::Right(access))]))
            .scan(false, |failing_check, item| {
                *failing_check =
                    *failing_check || item.as_ref().is_ok_and(itertools::Either::is_left);
                futures::future::ready(match &item {
                    // if there's a failing check, we keep it
                    Ok(itertools::Either::Left(_)) => Some(item),
                    // we keep the access handle only if there's no failing check
                    Ok(itertools::Either::Right(_)) if *failing_check => None,
                    Ok(itertools::Either::Right(_)) => Some(item),
                    // errors are forwarded
                    Err(_) => Some(item),
                })
            })
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

    fn actor_user(&self, actor: Actor) -> authz::User {
        match actor {
            Actor::Issuer => self.user,
            Actor::User(user) => user,
        }
    }

    #[tracing::instrument(target = "UserAutorizer::check", skip_all, fields(?check, issuer = ?self.user, roles = ?self.roles), ret(level = "trace"), err)]
    async fn check(&self, check: Check) -> Result<Option<Check>, Error> {
        if self.roles.contains(&authz::Role::Admin) {
            return SystemAuthorizer {
                openfga: self.openfga,
                conn: self.conn.clone(),
            }
            .check(check)
            .await;
        }
        Ok(match check {
            Check::HasRole(Actor::Issuer, role) if !self.roles.contains(&role) => Some(check),
            Check::HasRole(Actor::Issuer, _) => None,
            Check::HasRole(Actor::User(user), role) => {
                let Ok(roles) = authz::v2::subject_roles(authz::Subject::User(user))
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!roles.contains(&role)).then_some(check)
            }

            Check::HasInfraPrivilege(actor, privilege, infra) => {
                let Ok(privileges) = authz::v2::infra_privileges(self.actor_user(actor), infra)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!privileges.contains(&privilege)).then_some(check)
            }
            Check::HasRollingStockPrivilege(actor, privilege, rolling_stock) => {
                let Ok(privileges) =
                    authz::v2::rolling_stock_privileges(self.actor_user(actor), rolling_stock)
                        .access_authorized::<Infallible>(self.openfga)
                        .access()
                        .await?;
                (!privileges.contains(&privilege)).then_some(check)
            }
            Check::SubjectEffectiveInfraGrantIsNot(grant, subject, infra) => {
                let Ok(subject_grant) = authz::v2::infra_effective_grant(subject, infra)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (subject_grant == Some(grant)).then_some(check)
            }
            Check::IsNotLastInfraOwner(subject, infra) => {
                let Ok(owners) = authz::v2::infra_granted_subjects(infra, authz::InfraGrant::Owner)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (owners.len() == 1 && owners.contains(&subject)).then_some(check)
            }
            check @ (Check::SubjectExists(_)
            | Check::InfraExists(_)
            | Check::RollingStockExists(_)) => {
                SystemAuthorizer {
                    openfga: self.openfga,
                    conn: self.conn.clone(),
                }
                .check(check)
                .await?
            }
        })
    }
}

impl Authorizer for UserAuthorizer<'_> {
    type Rejection = Check;
    type Error = Error;

    #[tracing::instrument(skip_all)]
    fn run_checks<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> impl futures::stream::TryStream<
        Ok = itertools::Either<Self::Rejection, Access<'a, T, Infallible>>,
        Error = Self::Error,
    > {
        use futures::stream;
        use futures::stream::StreamExt as _;
        use futures::stream::TryStreamExt as _;
        let (checks, access) = data.unpack(self.openfga);
        let checks = checks
            .into_iter()
            .map(|check| self.check(check).in_current_span())
            .collect::<FuturesUnordered<_>>();
        checks
            .try_filter_map(async |check| Ok(check.map(itertools::Either::Left))) // filter out passing checks
            .chain(stream::iter(vec![Ok(itertools::Either::Right(access))]))
            .scan(false, |failing_check, item| {
                *failing_check =
                    *failing_check || item.as_ref().is_ok_and(itertools::Either::is_left);
                futures::future::ready(match &item {
                    // if there's a failing check, we keep it
                    Ok(itertools::Either::Left(_)) => Some(item),
                    // we keep the access handle only if there's no failing check
                    Ok(itertools::Either::Right(_)) if *failing_check => None,
                    Ok(itertools::Either::Right(_)) => Some(item),
                    // errors are forwarded
                    Err(_) => Some(item),
                })
            })
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

#[cfg(test)]
mod tests {
    use authz::InfraGrant;
    use authz::InfraPrivilege;
    use authz::Role;
    use authz::v2::Actor;
    use authz::v2::Check;
    use authz::v2::Protected;
    use database::DbConnectionPoolV2;
    use fga::model::Relation as _;
    use futures::TryStreamExt as _;
    use itertools::Either;
    use rstest::rstest;

    use super::*;
    use crate::fixtures::create_empty_infra;

    async fn openfga() -> fga::Client {
        let openfga = fga::test_client!("authz@");
        fga_migrations::run_migrations(
            openfga.clone(),
            fga::test_client!("migrations@"),
            fga_migrations::TargetMigration::Latest,
        )
        .await
        .expect("FGA migrations should succeed");
        openfga
    }

    async fn create_user(pool: &DbConnectionPoolV2, name: &str) -> authz::User {
        authz::User(
            editoast_models::User::register(pool.get_ok(), vec![name.to_owned()], name.to_owned())
                .await
                .expect("user should be created")
                .id,
        )
    }

    async fn create_group(pool: &DbConnectionPoolV2, name: &str) -> authz::Group {
        authz::Group(
            editoast_models::Group::upsert(pool.get_ok(), name.to_owned())
                .await
                .expect("group should be created")
                .id,
        )
    }

    async fn authorize<A>(authorizer: &A, check: Check) -> Result<(), <A as Authorizer>::Rejection>
    where
        A: Authorizer,
        <A as Authorizer>::Error: std::fmt::Debug,
    {
        authorizer
            .authorize(Protected::value(()).with_check(check))
            .await
            .unwrap()
            .access()
            .await
            .unwrap()
    }

    async fn run_checks_count<A, T>(authorizer: &A, data: Protected<T>) -> (usize, usize)
    where
        A: Authorizer<Rejection = Check>,
        A::Error: std::fmt::Debug,
    {
        let (left, right) = authorizer
            .run_checks(data)
            .try_fold((0, 0), async |(left, right), item| match item {
                Either::Left(_) => Ok((left + 1, right)),
                Either::Right(_) => Ok((left, right + 1)),
            })
            .await
            .unwrap();

        assert!(left + right > 0);
        assert!(
            (left > 0 && right == 0) || (left == 0 && right == 1),
            "expected one or more rejections or exactly one Access handle, got {left} rejections and {right} access handles"
        );
        (left, right)
    }

    #[rstest]
    #[case::pass(
        Protected::value(()).with_check(Check::HasRole(Actor::Issuer, Role::Admin)),
        (0, 1)
    )]
    #[case::fail(
        Protected::value(())
            .with_check(Check::user(authz::User(i64::MAX)))
            .with_check(Check::group(authz::Group(i64::MAX))),
        (2, 0)
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn system_authorizer_run_checks_invariant(
        #[case] protected: Protected<()>,
        #[case] expected: (usize, usize),
    ) {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        assert_eq!(run_checks_count(&system, protected).await, expected);
    }

    #[rstest]
    #[case::pass(
        Protected::value(()).with_check(Check::HasRole(Actor::Issuer, Role::Stdcm)),
        (0, 1)
    )]
    #[case::fail(
        Protected::value(())
            .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
            .with_check(Check::HasRole(Actor::Issuer, Role::OperationalStudies)),
        (2, 0)
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_run_checks_invariant(
        #[case] protected: Protected<()>,
        #[case] expected: (usize, usize),
    ) {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Stdcm], &openfga, pool.get_ok());
        assert_eq!(
            run_checks_count(&user_authorizer, protected).await,
            expected
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn existing_user() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        assert_eq!(authorize(&system, Check::user(user)).await, Ok(()));
        assert_eq!(authorize(&user_authorizer, Check::user(user)).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn missing_user() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        let check = Check::user(authz::User(i64::MAX));
        assert_eq!(authorize(&system, check).await, Err(check));
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn existing_group() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let group = create_group(&pool, "group").await;
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        assert_eq!(authorize(&system, Check::group(group)).await, Ok(()));
        assert_eq!(
            authorize(&user_authorizer, Check::group(group)).await,
            Ok(())
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn missing_group() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        let check = Check::group(authz::Group(i64::MAX));
        assert_eq!(authorize(&system, check).await, Err(check));
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn existing_infra() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        assert_eq!(authorize(&system, Check::InfraExists(infra)).await, Ok(()));
        assert_eq!(
            authorize(&user_authorizer, Check::InfraExists(infra)).await,
            Ok(())
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn missing_infra() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        let check = Check::InfraExists(authz::Infra(i64::MAX));
        assert_eq!(authorize(&system, check).await, Err(check));
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[rstest]
    #[case::has_role(Check::HasRole(Actor::Issuer, Role::Admin))]
    #[case::has_infra_privilege(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanDelete,
        authz::Infra(i64::MAX)
    ))]
    #[case::subject_effective_infra_grant_is_not(Check::SubjectEffectiveInfraGrantIsNot(
        InfraGrant::Owner,
        authz::Subject::User(authz::User(i64::MAX)),
        authz::Infra(i64::MAX)
    ))]
    #[case::is_not_last_infra_owner(Check::IsNotLastInfraOwner(
        authz::Subject::User(authz::User(i64::MAX)),
        authz::Infra(i64::MAX)
    ))]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn system_authorizer_ignores_non_sanity_checks(#[case] check: Check) {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let system = SystemAuthorizer {
            openfga: &openfga,
            conn: pool.get_ok(),
        };

        assert_eq!(authorize(&system, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_issuer_role() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "user").await;
        let user_authorizer = UserAuthorizer::new(
            user,
            vec![Role::OperationalStudies],
            &openfga,
            pool.get_ok(),
        );

        let check = Check::HasRole(Actor::Issuer, Role::OperationalStudies);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasRole(Actor::Issuer, Role::Stdcm);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_user_role() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let target = create_user(&pool, "target").await;
        openfga
            .write_tuples(&[authz::User::role().tuple(&Role::Stdcm, &target)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::HasRole(Actor::User(target), Role::Stdcm);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasRole(Actor::User(target), Role::Admin);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_issuer_infra_privilege() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let owner = create_user(&pool, "owner").await;
        let no_grant = create_user(&pool, "no-grant").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .write_tuples(&[authz::Infra::owner().tuple(&owner, &infra)])
            .await
            .unwrap();

        let user_authorizer = UserAuthorizer::new(owner, vec![], &openfga, pool.get_ok());
        let check = Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanDelete, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let user_authorizer = UserAuthorizer::new(no_grant, vec![], &openfga, pool.get_ok());
        let check = Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanShareRead, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_user_infra_privilege() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let target = create_user(&pool, "target").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .write_tuples(&[authz::Infra::writer().tuple(&target, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::HasInfraPrivilege(Actor::User(target), InfraPrivilege::CanWrite, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasInfraPrivilege(Actor::User(target), InfraPrivilege::CanDelete, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_infra_grant_is_not() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let target = create_user(&pool, "target").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .write_tuples(&[authz::Infra::owner().tuple(&target, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::SubjectEffectiveInfraGrantIsNot(
            InfraGrant::Owner,
            authz::Subject::User(target),
            infra,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::SubjectEffectiveInfraGrantIsNot(
            InfraGrant::Writer,
            authz::Subject::User(target),
            infra,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_infra_grant_is_not_checks_inherited_grant() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let target = create_user(&pool, "target").await;
        let group = create_group(&pool, "owners").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .prepare_writes()
            .write(&authz::Group::member().tuple(&target, &group))
            .write(&authz::Infra::owner().tuple(authz::Group::member().userset(&group), &infra))
            .execute()
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::SubjectEffectiveInfraGrantIsNot(
            InfraGrant::Owner,
            authz::Subject::User(target),
            infra,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_infra_owner_user() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let owner = create_user(&pool, "owner").await;
        let other_owner = create_user(&pool, "other-owner").await;
        let no_grant = create_user(&pool, "no-grant").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .write_tuples(&[authz::Infra::owner().tuple(&owner, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::IsNotLastInfraOwner(authz::Subject::User(owner), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::IsNotLastInfraOwner(authz::Subject::User(no_grant), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        openfga
            .write_tuples(&[authz::Infra::owner().tuple(&other_owner, &infra)])
            .await
            .unwrap();
        let check = Check::IsNotLastInfraOwner(authz::Subject::User(owner), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_infra_owner_group() {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let issuer = create_user(&pool, "issuer").await;
        let group = create_group(&pool, "group").await;
        let infra = authz::Infra(create_empty_infra(&mut pool.get_ok()).await.id);
        openfga
            .write_tuples(&[
                authz::Infra::owner().tuple(authz::Group::member().userset(&group), &infra)
            ])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga, pool.get_ok());

        let check = Check::IsNotLastInfraOwner(authz::Subject::Group(group), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[rstest]
    #[case::has_role(Check::HasRole(Actor::Issuer, Role::Admin))]
    #[case::has_infra_privilege(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanWrite,
        authz::Infra(i64::MAX)
    ))]
    #[case::subject_effective_infra_grant_is_not(Check::SubjectEffectiveInfraGrantIsNot(
        InfraGrant::Owner,
        authz::Subject::user(i64::MAX),
        authz::Infra(i64::MAX)
    ))]
    #[case::is_not_last_infra_owner(Check::IsNotLastInfraOwner(
        authz::Subject::user(i64::MAX),
        authz::Infra(i64::MAX)
    ))]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_admin_bypass(#[case] check: Check) {
        let openfga = openfga().await;
        let pool = DbConnectionPoolV2::for_tests();
        let user = create_user(&pool, "admin").await;
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga, pool.get_ok());

        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }
}
