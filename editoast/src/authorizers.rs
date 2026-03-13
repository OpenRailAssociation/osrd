use authz::v2::Access;
use authz::v2::Authorizer;
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
        Ok(data.blindly_authorize(self.openfga))
    }
}

#[derive(Debug)]
pub enum Rejection {
    NoSuchUser(i64),
    NoSuchGroup(#[expect(dead_code)] i64),
}

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
    }
}
