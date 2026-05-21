use std::collections::HashSet;

use fga::model::Relation as _;
use futures::FutureExt;

use crate::Role;
use crate::RollingStock;
use crate::Subject;

use crate::User;
use crate::model::RollingStockPrivilege;

use super::Guardrail;
use super::Protected;
use super::SanityCheck;

pub fn rolling_stock_privileges(
    user: User,
    rolling_stock: RollingStock,
) -> Protected<HashSet<RollingStockPrivilege>> {
    Protected::new(move |openfga| {
        async move {
            let (
                admin,
                can_read,
                can_share_read,
                can_write,
                can_share_write,
                can_delete,
                can_share_ownership,
            ) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
                    RollingStock::can_read().check(&user, &rolling_stock),
                    RollingStock::can_share_read().check(&user, &rolling_stock),
                    RollingStock::can_write().check(&user, &rolling_stock),
                    RollingStock::can_share_write().check(&user, &rolling_stock),
                    RollingStock::can_delete().check(&user, &rolling_stock),
                    RollingStock::can_share_ownership().check(&user, &rolling_stock),
                ))
                .await?;
            let mut privileges = HashSet::new();
            privileges.extend((admin || can_read).then_some(RollingStockPrivilege::CanRead));
            privileges
                .extend((admin || can_share_read).then_some(RollingStockPrivilege::CanShareRead));
            privileges.extend((admin || can_write).then_some(RollingStockPrivilege::CanWrite));
            privileges
                .extend((admin || can_share_write).then_some(RollingStockPrivilege::CanShareWrite));
            privileges.extend((admin || can_delete).then_some(RollingStockPrivilege::CanDelete));
            privileges.extend(
                (admin || can_share_ownership).then_some(RollingStockPrivilege::CanShareOwnership),
            );
            Ok(privileges)
        }
        .boxed()
    })
    .with_check(SanityCheck::RollingStockExists(rolling_stock))
    .with_check(SanityCheck::SubjectExists(Subject::user(user)))
    .with_guardrail(Guardrail::IssuerHasRollingStockPrivilege(
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
}

#[cfg(test)]
mod tests {
    use crate::v2::TestClientExt as _;

    use super::*;

    #[tokio::test]
    async fn rolling_stock_privileges_non_admin() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[RollingStock::writer().tuple(&User(1), &RollingStock(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::from_iter([
                RollingStockPrivilege::CanRead,
                RollingStockPrivilege::CanShareRead,
                RollingStockPrivilege::CanWrite,
                RollingStockPrivilege::CanShareWrite,
            ])
        );
    }

    #[tokio::test]
    async fn rolling_stock_privileges_admin() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&User::role().tuple(&Role::Admin, &User(1)))
            .write(&RollingStock::reader().tuple(&User(2), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::from_iter([
                RollingStockPrivilege::CanRead,
                RollingStockPrivilege::CanShareRead,
                RollingStockPrivilege::CanWrite,
                RollingStockPrivilege::CanShareWrite,
                RollingStockPrivilege::CanDelete,
                RollingStockPrivilege::CanShareOwnership,
            ])
        );
    }

    #[tokio::test]
    async fn no_rolling_stock_privileges() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[RollingStock::reader().tuple(&User(2), &RollingStock(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::new(),
        );
    }
}
