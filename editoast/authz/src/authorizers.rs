use std::convert::Infallible;
use std::marker::PhantomData;
use std::ops::Not as _;

use crate::InfraGrant;
use crate::ProjectGrant;
use crate::Role;
use crate::RollingStockGrant;
use crate::Subject;
use crate::User;
use crate::v2::Access;
use crate::v2::Actor;
use crate::v2::Authorizer;
use crate::v2::Check;
use crate::v2::OpenFgaError;
use crate::v2::Protected;
use crate::v2::infra_effective_grant;
use crate::v2::infra_granted_subjects;
use crate::v2::infra_privileges;
use crate::v2::project_effective_grant;
use crate::v2::project_privileges;
use crate::v2::rolling_stock_effective_grant;
use crate::v2::rolling_stock_granted_subjects;
use crate::v2::rolling_stock_privileges;
use crate::v2::subject_roles;
use futures::StreamExt as _;
use futures::stream::FuturesUnordered;
use tracing::Instrument as _;

/// An authorizer that represents editoast's authorization decisions
///
/// Decorrelated from any user, this authorizer is used for actions that the
/// system knows are correct. For example, attributing the first owner of a new resource.
///
/// No user can be associated with this authorizer.
///
/// This authorizer performs no checks and thus [`Authorizer::authorize`] always succeeds
/// and never rejects. But always setting the rejection type to [`Infallible`], while convenient
/// when [`SystemAuthorizer`] is used directly, hurts authorizer production by
/// `editoast::authentication::State::authorizer`. So you can provide this type whichever
/// rejection type you prefer.
pub struct SystemAuthorizer<'a, R = Infallible> {
    openfga: &'a fga::Client,
    rejection: PhantomData<R>,
}

impl<'a, R> SystemAuthorizer<'a, R> {
    pub fn new(openfga: &'a fga::Client) -> Self {
        Self {
            openfga,
            rejection: PhantomData,
        }
    }
}

impl<'a> SystemAuthorizer<'a, Infallible> {
    /// Shortcut for `SystemAuthorizer::<Infallible>::new`.
    ///
    /// Avoids having to import the name.
    pub fn new_infallible(openfga: &'a fga::Client) -> Self {
        Self::new(openfga)
    }
}

impl<R> Authorizer for SystemAuthorizer<'_, R> {
    type Rejection = R;
    type Error = Error;

    #[tracing::instrument(skip_all)]
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        Ok(data.access_authorized(self.openfga))
    }
}

pub struct UserAuthorizer<'c> {
    pub user: User,
    pub roles: Vec<Role>, // TODO: use a SmallVec
    pub openfga: &'c fga::Client,
}

impl<'c> UserAuthorizer<'c> {
    pub fn new(user: User, roles: Vec<Role>, openfga: &'c fga::Client) -> Self {
        Self {
            user,
            roles,
            openfga,
        }
    }

    fn actor_user<'a>(&'a self, actor: &'a Actor) -> &'a User {
        match actor {
            Actor::Issuer => &self.user,
            Actor::User(user) => user,
        }
    }

    fn issuer(&self) -> Subject {
        Subject::User(self.user)
    }

    #[tracing::instrument(target = "UserAutorizer::check", skip_all, fields(?check, issuer = ?self.user, roles = ?self.roles), ret(level = "trace"), err)]
    async fn check<'ch>(&self, check: &'ch Check) -> Result<Option<&'ch Check>, Error> {
        Ok(match check {
            Check::HasRole(Actor::Issuer, role) if !self.roles.contains(role) => Some(check),
            Check::HasRole(Actor::Issuer, _) => None,
            Check::HasRole(Actor::User(user), role) => {
                let Ok(roles) = subject_roles(Subject::User(*user))
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!roles.contains(role)).then_some(check)
            }

            Check::HasInfraPrivilege(actor, privilege, infra) => {
                let Ok(privileges) = infra_privileges(*self.actor_user(actor), *infra)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!privileges.contains(privilege)).then_some(check)
            }
            Check::HasRollingStockPrivilege(actor, privilege, rolling_stock) => {
                let Ok(privileges) =
                    rolling_stock_privileges(*self.actor_user(actor), *rolling_stock)
                        .access_authorized::<Infallible>(self.openfga)
                        .access()
                        .await?;
                (!privileges.contains(privilege)).then_some(check)
            }
            Check::HasProjectPrivilege(actor, privilege, project) => {
                let Ok(privileges) = project_privileges(*self.actor_user(actor), *project)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (!privileges.contains(privilege)).then_some(check)
            }

            Check::CanAlterSubjectInfraGrant(subject @ Subject::User(_), infra, new_grant) => {
                let issuer = self.issuer();
                let Ok((issuer_grant, current_grant)) = infra_effective_grant(issuer, *infra)
                    .zip(infra_effective_grant(*subject, *infra))
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                let Some(issuer_grant) = issuer_grant else {
                    // According to the authorization model, non-Admin users must have a grant to share
                    return Ok(Some(check));
                };

                current_grant.and_then(|current_grant| {
                    let no_op = current_grant == *new_grant;
                    let altering_self = issuer == *subject;
                    let altering_underling = current_grant < issuer_grant;
                    let promoting_above_me = issuer_grant < *new_grant;
                    (!promoting_above_me && (no_op || altering_self || altering_underling))
                        .not()
                        .then_some(check)
                })
            }
            Check::CanAlterSubjectInfraGrant(Subject::Group(_), _, _) => {
                // The only users allowed to alter groups grants are admins who bypass this entire
                // verification function.
                Some(check)
            }

            Check::CanGiveSubjectProjectGrant(Subject::User(_), project) => {
                // There is only one level of grant. The issuer must own a grant on the project to
                // share it to other users.
                let Ok(grant) = project_effective_grant(self.issuer(), *project)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;

                match grant {
                    Some(ProjectGrant::Owner) => None,
                    None => Some(check),
                }
            }
            Check::CanGiveSubjectProjectGrant(Subject::Group(_), _) => {
                // The only users to allowed to alter group grants are admins who bypass this entire
                // verification function: trying to give a grant to a group in the UserAuthorizer should
                // always be rejected
                Some(check)
            }

            Check::SubjectEffectiveInfraGrantIsNot(grant, subject, infra) => {
                let Ok(subject_grant) = infra_effective_grant(*subject, *infra)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (subject_grant == Some(*grant)).then_some(check)
            }
            Check::CanAlterSubjectRollingStockGrant(
                subject @ Subject::User(_),
                rolling_stock,
                new_grant,
            ) => {
                let issuer = self.issuer();
                let Ok((issuer_grant, current_grant)) =
                    rolling_stock_effective_grant(issuer, *rolling_stock)
                        .zip(rolling_stock_effective_grant(*subject, *rolling_stock))
                        .access_authorized::<Infallible>(self.openfga)
                        .access()
                        .await?;
                let Some(issuer_grant) = issuer_grant else {
                    // According to the authorization model, non-Admin users must have a grant to share
                    return Ok(Some(check));
                };

                current_grant.and_then(|current_grant| {
                    let no_op = current_grant == *new_grant;
                    let altering_self = issuer == *subject;
                    let altering_underling = current_grant < issuer_grant;
                    let promoting_above_me = issuer_grant < *new_grant;
                    (!promoting_above_me && (no_op || altering_self || altering_underling))
                        .not()
                        .then_some(check)
                })
            }
            Check::CanAlterSubjectRollingStockGrant(Subject::Group(_), _, _) => {
                // The only users allowed to alter groups grants are admins who bypass this entire
                // verification function.
                Some(check)
            }
            Check::SubjectEffectiveRollingStockGrantIsNot(grant, subject, rolling_stock) => {
                let Ok(subject_grant) = rolling_stock_effective_grant(*subject, *rolling_stock)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (subject_grant == Some(*grant)).then_some(check)
            }
            Check::IsNotLastInfraOwner(subject, infra) => {
                let Ok(owners) = infra_granted_subjects(*infra, InfraGrant::Owner)
                    .access_authorized::<Infallible>(self.openfga)
                    .access()
                    .await?;
                (owners.len() == 1 && owners.contains(subject)).then_some(check)
            }
            Check::IsNotLastRollingStockOwner(subject, rolling_stock) => {
                let Ok(owners) =
                    rolling_stock_granted_subjects(*rolling_stock, RollingStockGrant::Owner)
                        .access_authorized::<Infallible>(self.openfga)
                        .access()
                        .await?;
                (owners.len() == 1 && owners.contains(subject)).then_some(check)
            }
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
        {
            // scoping to tell the borrow checker that checks is consumed before returning
            // access_authorized which takes ownership of data
            let mut checks = FuturesUnordered::new();
            if !self.roles.contains(&Role::Admin) {
                for check in &data.checks {
                    checks.push(self.check(check).in_current_span());
                }
            }
            while let Some(result) = checks.next().await {
                if let Some(check) = result? {
                    tracing::error!(user = ?self.user, ?check, "authorization denied");
                    return Ok(Access::Denied { rejection: *check });
                }
            }
        }
        Ok(data.access_authorized(self.openfga))
    }
}

#[derive(Debug, thiserror::Error)]
#[error(transparent)]
pub struct Error(#[from] pub OpenFgaError);

#[cfg(test)]
mod tests {
    use fga::model::Relation as _;
    use rstest::rstest;

    use crate::Group;
    use crate::Infra;
    use crate::InfraPrivilege;
    use crate::RollingStock;
    use crate::RollingStockPrivilege;

    use super::*;

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

    #[rstest]
    #[case::has_role(Check::HasRole(Actor::Issuer, Role::Admin))]
    #[case::has_infra_privilege(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanDelete,
        Infra(i64::MAX)
    ))]
    #[case::can_alter_subject_infra_grant(Check::CanAlterSubjectInfraGrant(
        Subject::user(i64::MAX),
        Infra(i64::MAX),
        InfraGrant::Reader,
    ))]
    #[case::subject_effective_infra_grant_is_not(Check::SubjectEffectiveInfraGrantIsNot(
        InfraGrant::Owner,
        Subject::user(i64::MAX),
        Infra(i64::MAX)
    ))]
    #[case::is_not_last_infra_owner(Check::IsNotLastInfraOwner(
        Subject::user(i64::MAX),
        Infra(i64::MAX)
    ))]
    #[case::can_alter_subject_rolling_stock_grant(Check::CanAlterSubjectRollingStockGrant(
        Subject::user(i64::MAX),
        RollingStock(i64::MAX),
        RollingStockGrant::Reader,
    ))]
    #[case::subject_effective_rolling_stock_grant_is_not(
        Check::SubjectEffectiveRollingStockGrantIsNot(
            RollingStockGrant::Owner,
            Subject::user(i64::MAX),
            RollingStock(i64::MAX)
        )
    )]
    #[case::is_not_last_rolling_stock_owner(Check::IsNotLastRollingStockOwner(
        Subject::user(i64::MAX),
        RollingStock(i64::MAX)
    ))]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn system_authorizer_ignores_non_sanity_checks(#[case] check: Check) {
        let openfga = openfga().await;
        let system = SystemAuthorizer::new_infallible(&openfga);

        assert_eq!(authorize(&system, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_issuer_role() {
        let openfga = openfga().await;
        let user = User(1);
        let user_authorizer = UserAuthorizer::new(user, vec![Role::OperationalStudies], &openfga);

        let check = Check::HasRole(Actor::Issuer, Role::OperationalStudies);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasRole(Actor::Issuer, Role::Stdcm);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_user_role() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        openfga
            .write_tuples(&[User::role().tuple(&Role::Stdcm, &target)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::HasRole(Actor::User(target), Role::Stdcm);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasRole(Actor::User(target), Role::Admin);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_issuer_infra_privilege() {
        let openfga = openfga().await;
        let owner = User(1);
        let no_grant = User(2);
        let infra = Infra(1);
        openfga
            .write_tuples(&[Infra::owner().tuple(&owner, &infra)])
            .await
            .unwrap();

        let user_authorizer = UserAuthorizer::new(owner, vec![], &openfga);
        let check = Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanDelete, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let user_authorizer = UserAuthorizer::new(no_grant, vec![], &openfga);
        let check = Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanShareRead, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_issuer_rolling_stock_privilege() {
        let openfga = openfga().await;
        let owner = User(1);
        let no_grant = User(2);
        let rolling_stock = RollingStock(1);
        openfga
            .write_tuples(&[RollingStock::owner().tuple(&owner, &rolling_stock)])
            .await
            .unwrap();

        let user_authorizer = UserAuthorizer::new(owner, vec![], &openfga);
        let check = Check::HasRollingStockPrivilege(
            Actor::Issuer,
            RollingStockPrivilege::CanDelete,
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let user_authorizer = UserAuthorizer::new(no_grant, vec![], &openfga);
        let check = Check::HasRollingStockPrivilege(
            Actor::Issuer,
            RollingStockPrivilege::CanShareRead,
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_user_infra_privilege() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let infra = Infra(1);
        openfga
            .write_tuples(&[Infra::writer().tuple(&target, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::HasInfraPrivilege(Actor::User(target), InfraPrivilege::CanWrite, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasInfraPrivilege(Actor::User(target), InfraPrivilege::CanDelete, infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    mod can_alter_subject_infra_grant {
        use super::*;

        const ISSUER_NOTHING: User = User(0);
        const ISSUER_READER: User = User(1);
        const ISSUER_WRITER: User = User(2);
        const ISSUER_OWNER: User = User(3);
        const USER_NOTHING: Subject = Subject::User(User(4));
        const USER_READER: Subject = Subject::User(User(5));
        const USER_WRITER: Subject = Subject::User(User(6));
        const USER_OWNER: Subject = Subject::User(User(7));
        const GROUP_NOTHING: Subject = Subject::Group(Group(8));
        const GROUP_READER: Subject = Subject::Group(Group(9));
        const GROUP_WRITER: Subject = Subject::Group(Group(10));
        const GROUP_OWNER: Subject = Subject::Group(Group(11));

        #[rstest]
        // a user grants another user
        #[case::target_user_1(ISSUER_READER, USER_NOTHING, InfraGrant::Reader, true)]
        #[case::target_user_2(ISSUER_READER, USER_READER, InfraGrant::Reader, true)]
        #[case::target_user_3(ISSUER_READER, USER_WRITER, InfraGrant::Reader, false)]
        #[case::target_user_4(ISSUER_READER, USER_OWNER, InfraGrant::Reader, false)]
        #[case::target_user_5(ISSUER_WRITER, USER_NOTHING, InfraGrant::Writer, true)]
        #[case::target_user_6(ISSUER_WRITER, USER_READER, InfraGrant::Writer, true)]
        #[case::target_user_7(ISSUER_WRITER, USER_WRITER, InfraGrant::Writer, true)]
        #[case::target_user_8(ISSUER_WRITER, USER_OWNER, InfraGrant::Writer, false)]
        #[case::target_user_9(ISSUER_OWNER, USER_NOTHING, InfraGrant::Owner, true)]
        #[case::target_user_10(ISSUER_OWNER, USER_READER, InfraGrant::Owner, true)]
        #[case::target_user_11(ISSUER_OWNER, USER_WRITER, InfraGrant::Owner, true)]
        #[case::target_user_12(ISSUER_OWNER, USER_OWNER, InfraGrant::Owner, true)]
        // non-admins cannot grant groups
        #[case::target_group_1(ISSUER_READER, GROUP_NOTHING, InfraGrant::Reader, false)]
        #[case::target_group_2(ISSUER_READER, GROUP_READER, InfraGrant::Reader, false)]
        #[case::target_group_3(ISSUER_READER, GROUP_WRITER, InfraGrant::Reader, false)]
        #[case::target_group_4(ISSUER_READER, GROUP_OWNER, InfraGrant::Reader, false)]
        #[case::target_group_5(ISSUER_WRITER, GROUP_NOTHING, InfraGrant::Writer, false)]
        #[case::target_group_6(ISSUER_WRITER, GROUP_READER, InfraGrant::Writer, false)]
        #[case::target_group_7(ISSUER_WRITER, GROUP_WRITER, InfraGrant::Writer, false)]
        #[case::target_group_8(ISSUER_WRITER, GROUP_OWNER, InfraGrant::Writer, false)]
        #[case::target_group_9(ISSUER_OWNER, GROUP_NOTHING, InfraGrant::Owner, false)]
        #[case::target_group_10(ISSUER_OWNER, GROUP_READER, InfraGrant::Owner, false)]
        #[case::target_group_11(ISSUER_OWNER, GROUP_WRITER, InfraGrant::Owner, false)]
        #[case::target_group_12(ISSUER_OWNER, GROUP_OWNER, InfraGrant::Owner, false)]
        // targeting self is allowed within privilege limits
        #[case::target_self_1(
            ISSUER_READER,
            Subject::User(ISSUER_READER),
            InfraGrant::Reader,
            true
        )]
        #[case::target_self_2(
            ISSUER_WRITER,
            Subject::User(ISSUER_WRITER),
            InfraGrant::Writer,
            true
        )]
        #[case::target_self_3(ISSUER_OWNER, Subject::User(ISSUER_OWNER), InfraGrant::Owner, true)]
        // a user with no grant do not have the privilege to share grants
        #[case::unreachable(ISSUER_NOTHING, USER_NOTHING, InfraGrant::Reader, false)]
        #[case::noop_1(ISSUER_READER, USER_READER, InfraGrant::Reader, true)]
        #[case::noop_2(ISSUER_WRITER, USER_READER, InfraGrant::Reader, true)]
        #[case::noop_3(ISSUER_OWNER, USER_READER, InfraGrant::Reader, true)]
        #[case::noop_4(ISSUER_READER, USER_WRITER, InfraGrant::Writer, false)]
        #[case::noop_5(ISSUER_WRITER, USER_WRITER, InfraGrant::Writer, true)]
        #[case::noop_6(ISSUER_OWNER, USER_WRITER, InfraGrant::Writer, true)]
        #[case::noop_7(ISSUER_READER, USER_OWNER, InfraGrant::Owner, false)]
        #[case::noop_8(ISSUER_WRITER, USER_OWNER, InfraGrant::Owner, false)]
        #[case::noop_9(ISSUER_OWNER, USER_OWNER, InfraGrant::Owner, true)]
        // -----
        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn test(
            #[case] issuer: User,
            #[case] target: Subject,
            #[case] grant: InfraGrant,
            #[case] ok: bool,
        ) {
            let openfga = openfga().await;
            let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

            openfga
                .prepare_writes()
                .write(&Infra::reader().tuple(&ISSUER_READER, &Infra(1)))
                .write(&Infra::writer().tuple(&ISSUER_WRITER, &Infra(1)))
                .write(&Infra::owner().tuple(&ISSUER_OWNER, &Infra(1)))
                .write(&Infra::reader().tuple(&User(USER_READER.id()), &Infra(1)))
                .write(&Infra::writer().tuple(&User(USER_WRITER.id()), &Infra(1)))
                .write(&Infra::owner().tuple(&User(USER_OWNER.id()), &Infra(1)))
                .write(&Infra::reader().tuple(
                    Group::member().userset(&Group(GROUP_READER.id())),
                    &Infra(1),
                ))
                .write(&Infra::writer().tuple(
                    Group::member().userset(&Group(GROUP_WRITER.id())),
                    &Infra(1),
                ))
                .write(
                    &Infra::owner()
                        .tuple(Group::member().userset(&Group(GROUP_OWNER.id())), &Infra(1)),
                )
                .execute()
                .await
                .unwrap();

            let check = Check::CanAlterSubjectInfraGrant(target, Infra(1), grant);
            let result = authorize(&user_authorizer, check).await;
            let expected = ok.then_some(()).ok_or(check);
            assert_eq!(result, expected);
        }
    }

    mod can_alter_subject_rolling_stock_grant {
        use super::*;

        const ISSUER_NOTHING: User = User(0);
        const ISSUER_READER: User = User(1);
        const ISSUER_WRITER: User = User(2);
        const ISSUER_OWNER: User = User(3);
        const USER_NOTHING: Subject = Subject::User(User(4));
        const USER_READER: Subject = Subject::User(User(5));
        const USER_WRITER: Subject = Subject::User(User(6));
        const USER_OWNER: Subject = Subject::User(User(7));
        const GROUP_NOTHING: Subject = Subject::Group(Group(8));
        const GROUP_READER: Subject = Subject::Group(Group(9));
        const GROUP_WRITER: Subject = Subject::Group(Group(10));
        const GROUP_OWNER: Subject = Subject::Group(Group(11));

        #[rstest]
        // a user grants another user
        #[case::target_user_1(ISSUER_READER, USER_NOTHING, RollingStockGrant::Reader, true)]
        #[case::target_user_2(ISSUER_READER, USER_READER, RollingStockGrant::Reader, true)]
        #[case::target_user_3(ISSUER_READER, USER_WRITER, RollingStockGrant::Reader, false)]
        #[case::target_user_4(ISSUER_READER, USER_OWNER, RollingStockGrant::Reader, false)]
        #[case::target_user_5(ISSUER_WRITER, USER_NOTHING, RollingStockGrant::Writer, true)]
        #[case::target_user_6(ISSUER_WRITER, USER_READER, RollingStockGrant::Writer, true)]
        #[case::target_user_7(ISSUER_WRITER, USER_WRITER, RollingStockGrant::Writer, true)]
        #[case::target_user_8(ISSUER_WRITER, USER_OWNER, RollingStockGrant::Writer, false)]
        #[case::target_user_9(ISSUER_OWNER, USER_NOTHING, RollingStockGrant::Owner, true)]
        #[case::target_user_10(ISSUER_OWNER, USER_READER, RollingStockGrant::Owner, true)]
        #[case::target_user_11(ISSUER_OWNER, USER_WRITER, RollingStockGrant::Owner, true)]
        #[case::target_user_12(ISSUER_OWNER, USER_OWNER, RollingStockGrant::Owner, true)]
        // non-admins cannot grant groups
        #[case::target_group_1(ISSUER_READER, GROUP_NOTHING, RollingStockGrant::Reader, false)]
        #[case::target_group_2(ISSUER_READER, GROUP_READER, RollingStockGrant::Reader, false)]
        #[case::target_group_3(ISSUER_READER, GROUP_WRITER, RollingStockGrant::Reader, false)]
        #[case::target_group_4(ISSUER_READER, GROUP_OWNER, RollingStockGrant::Reader, false)]
        #[case::target_group_5(ISSUER_WRITER, GROUP_NOTHING, RollingStockGrant::Writer, false)]
        #[case::target_group_6(ISSUER_WRITER, GROUP_READER, RollingStockGrant::Writer, false)]
        #[case::target_group_7(ISSUER_WRITER, GROUP_WRITER, RollingStockGrant::Writer, false)]
        #[case::target_group_8(ISSUER_WRITER, GROUP_OWNER, RollingStockGrant::Writer, false)]
        #[case::target_group_9(ISSUER_OWNER, GROUP_NOTHING, RollingStockGrant::Owner, false)]
        #[case::target_group_10(ISSUER_OWNER, GROUP_READER, RollingStockGrant::Owner, false)]
        #[case::target_group_11(ISSUER_OWNER, GROUP_WRITER, RollingStockGrant::Owner, false)]
        #[case::target_group_12(ISSUER_OWNER, GROUP_OWNER, RollingStockGrant::Owner, false)]
        // targeting self is allowed within privilege limits
        #[case::target_self_1(
            ISSUER_READER,
            Subject::User(ISSUER_READER),
            RollingStockGrant::Reader,
            true
        )]
        #[case::target_self_2(
            ISSUER_WRITER,
            Subject::User(ISSUER_WRITER),
            RollingStockGrant::Writer,
            true
        )]
        #[case::target_self_3(
            ISSUER_OWNER,
            Subject::User(ISSUER_OWNER),
            RollingStockGrant::Owner,
            true
        )]
        // a user with no grant do not have the privilege to share grants
        #[case::unreachable(ISSUER_NOTHING, USER_NOTHING, RollingStockGrant::Reader, false)]
        #[case::noop_1(ISSUER_READER, USER_READER, RollingStockGrant::Reader, true)]
        #[case::noop_2(ISSUER_WRITER, USER_READER, RollingStockGrant::Reader, true)]
        #[case::noop_3(ISSUER_OWNER, USER_READER, RollingStockGrant::Reader, true)]
        #[case::noop_4(ISSUER_READER, USER_WRITER, RollingStockGrant::Writer, false)]
        #[case::noop_5(ISSUER_WRITER, USER_WRITER, RollingStockGrant::Writer, true)]
        #[case::noop_6(ISSUER_OWNER, USER_WRITER, RollingStockGrant::Writer, true)]
        #[case::noop_7(ISSUER_READER, USER_OWNER, RollingStockGrant::Owner, false)]
        #[case::noop_8(ISSUER_WRITER, USER_OWNER, RollingStockGrant::Owner, false)]
        #[case::noop_9(ISSUER_OWNER, USER_OWNER, RollingStockGrant::Owner, true)]
        // -----
        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn test(
            #[case] issuer: User,
            #[case] target: Subject,
            #[case] grant: RollingStockGrant,
            #[case] ok: bool,
        ) {
            let openfga = openfga().await;
            let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

            openfga
                .prepare_writes()
                .write(&RollingStock::reader().tuple(&ISSUER_READER, &RollingStock(1)))
                .write(&RollingStock::writer().tuple(&ISSUER_WRITER, &RollingStock(1)))
                .write(&RollingStock::owner().tuple(&ISSUER_OWNER, &RollingStock(1)))
                .write(&RollingStock::reader().tuple(&User(USER_READER.id()), &RollingStock(1)))
                .write(&RollingStock::writer().tuple(&User(USER_WRITER.id()), &RollingStock(1)))
                .write(&RollingStock::owner().tuple(&User(USER_OWNER.id()), &RollingStock(1)))
                .write(&RollingStock::reader().tuple(
                    Group::member().userset(&Group(GROUP_READER.id())),
                    &RollingStock(1),
                ))
                .write(&RollingStock::writer().tuple(
                    Group::member().userset(&Group(GROUP_WRITER.id())),
                    &RollingStock(1),
                ))
                .write(&RollingStock::owner().tuple(
                    Group::member().userset(&Group(GROUP_OWNER.id())),
                    &RollingStock(1),
                ))
                .execute()
                .await
                .unwrap();

            let check = Check::CanAlterSubjectRollingStockGrant(target, RollingStock(1), grant);
            let result = authorize(&user_authorizer, check).await;
            let expected = ok.then_some(()).ok_or(check);
            assert_eq!(result, expected);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_user_rolling_stock_privilege() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let rolling_stock = RollingStock(1);
        openfga
            .write_tuples(&[RollingStock::writer().tuple(&target, &rolling_stock)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::HasRollingStockPrivilege(
            Actor::User(target),
            RollingStockPrivilege::CanWrite,
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        let check = Check::HasRollingStockPrivilege(
            Actor::User(target),
            RollingStockPrivilege::CanDelete,
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_infra_grant_is_not() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let infra = Infra(1);
        openfga
            .write_tuples(&[Infra::owner().tuple(&target, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check =
            Check::SubjectEffectiveInfraGrantIsNot(InfraGrant::Owner, Subject::User(target), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::SubjectEffectiveInfraGrantIsNot(
            InfraGrant::Writer,
            Subject::User(target),
            infra,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_rolling_stock_grant_is_not() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let rolling_stock = RollingStock(1);
        openfga
            .write_tuples(&[RollingStock::owner().tuple(&target, &rolling_stock)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::SubjectEffectiveRollingStockGrantIsNot(
            RollingStockGrant::Owner,
            Subject::User(target),
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::SubjectEffectiveRollingStockGrantIsNot(
            RollingStockGrant::Writer,
            Subject::User(target),
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_infra_grant_is_not_checks_inherited_grant() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let group = Group(1);
        let infra = Infra(1);
        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&target, &group))
            .write(&Infra::owner().tuple(Group::member().userset(&group), &infra))
            .execute()
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check =
            Check::SubjectEffectiveInfraGrantIsNot(InfraGrant::Owner, Subject::User(target), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_subject_effective_rolling_stock_grant_is_not_checks_inherited_grant() {
        let openfga = openfga().await;
        let issuer = User(1);
        let target = User(2);
        let group = Group(1);
        let rolling_stock = RollingStock(1);
        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&target, &group))
            .write(&RollingStock::owner().tuple(Group::member().userset(&group), &rolling_stock))
            .execute()
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::SubjectEffectiveRollingStockGrantIsNot(
            RollingStockGrant::Owner,
            Subject::User(target),
            rolling_stock,
        );
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_infra_owner_user() {
        let openfga = openfga().await;
        let issuer = User(1);
        let owner = User(2);
        let other_owner = User(3);
        let no_grant = User(4);
        let infra = Infra(1);
        openfga
            .write_tuples(&[Infra::owner().tuple(&owner, &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::IsNotLastInfraOwner(Subject::User(owner), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::IsNotLastInfraOwner(Subject::User(no_grant), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        openfga
            .write_tuples(&[Infra::owner().tuple(&other_owner, &infra)])
            .await
            .unwrap();
        let check = Check::IsNotLastInfraOwner(Subject::User(owner), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_rolling_stock_owner_user() {
        let openfga = openfga().await;
        let issuer = User(1);
        let owner = User(2);
        let other_owner = User(3);
        let no_grant = User(4);
        let rolling_stock = RollingStock(1);
        openfga
            .write_tuples(&[RollingStock::owner().tuple(&owner, &rolling_stock)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::IsNotLastRollingStockOwner(Subject::User(owner), rolling_stock);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));

        let check = Check::IsNotLastRollingStockOwner(Subject::User(no_grant), rolling_stock);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));

        openfga
            .write_tuples(&[RollingStock::owner().tuple(&other_owner, &rolling_stock)])
            .await
            .unwrap();
        let check = Check::IsNotLastRollingStockOwner(Subject::User(owner), rolling_stock);
        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_infra_owner_group() {
        let openfga = openfga().await;
        let issuer = User(1);
        let group = Group(1);
        let infra = Infra(1);
        openfga
            .write_tuples(&[Infra::owner().tuple(Group::member().userset(&group), &infra)])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::IsNotLastInfraOwner(Subject::Group(group), infra);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_is_not_last_rolling_stock_owner_group() {
        let openfga = openfga().await;
        let issuer = User(1);
        let group = Group(1);
        let rolling_stock = RollingStock(1);
        openfga
            .write_tuples(&[
                RollingStock::owner().tuple(Group::member().userset(&group), &rolling_stock)
            ])
            .await
            .unwrap();
        let user_authorizer = UserAuthorizer::new(issuer, vec![], &openfga);

        let check = Check::IsNotLastRollingStockOwner(Subject::Group(group), rolling_stock);
        assert_eq!(authorize(&user_authorizer, check).await, Err(check));
    }

    #[rstest]
    #[case::has_role(Check::HasRole(Actor::Issuer, Role::Admin))]
    #[case::has_infra_privilege(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanWrite,
        Infra(i64::MAX)
    ))]
    #[case::can_alter_subject_infra_grant(Check::CanAlterSubjectInfraGrant(
        Subject::user(i64::MAX),
        Infra(i64::MAX),
        InfraGrant::Reader,
    ))]
    #[case::subject_effective_infra_grant_is_not(Check::SubjectEffectiveInfraGrantIsNot(
        InfraGrant::Owner,
        Subject::user(i64::MAX),
        Infra(i64::MAX)
    ))]
    #[case::is_not_last_infra_owner(Check::IsNotLastInfraOwner(
        Subject::user(i64::MAX),
        Infra(i64::MAX)
    ))]
    #[case::can_alter_subject_rolling_stock_grant(Check::CanAlterSubjectRollingStockGrant(
        Subject::user(i64::MAX),
        RollingStock(i64::MAX),
        RollingStockGrant::Reader,
    ))]
    #[case::subject_effective_rolling_stock_grant_is_not(
        Check::SubjectEffectiveRollingStockGrantIsNot(
            RollingStockGrant::Owner,
            Subject::user(i64::MAX),
            RollingStock(i64::MAX)
        )
    )]
    #[case::is_not_last_infra_owner(Check::IsNotLastRollingStockOwner(
        Subject::user(i64::MAX),
        RollingStock(i64::MAX)
    ))]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn user_authorizer_admin_bypass(#[case] check: Check) {
        let openfga = openfga().await;
        let user = User(1);
        let user_authorizer = UserAuthorizer::new(user, vec![Role::Admin], &openfga);

        assert_eq!(authorize(&user_authorizer, check).await, Ok(()));
    }
}
