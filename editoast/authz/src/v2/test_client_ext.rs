use std::collections::HashSet;

use fga::model::Relation as _;

use crate::Group;
use crate::Infra;
use crate::InfraGrant;
use crate::InfraPrivilege;
use crate::Role;
use crate::RollingStock;
use crate::Subject;
use crate::User;
use crate::model::RollingStockPrivilege;
use crate::v2::infra_direct_grant;
use crate::v2::infra_effective_grant;
use crate::v2::infra_privileges;
use crate::v2::rolling_stock_privileges;
use crate::v2::special_authorizers;

pub trait TestClientExt {
    async fn subject_roles(&self, subject: &Subject) -> HashSet<Role>;
    async fn group_members(&self, group: &Group) -> HashSet<User>;
    async fn infra_effective_grant(&self, subject: Subject, infra: Infra) -> Option<InfraGrant>;
    async fn infra_direct_grant(
        &self,
        subject: impl Into<Subject>,
        infra: Infra,
    ) -> Option<InfraGrant>;
    async fn infra_privileges(&self, user: User, infra: Infra) -> HashSet<InfraPrivilege>;
    async fn rolling_stock_privileges(
        &self,
        user: User,
        rolling_stock: RollingStock,
    ) -> HashSet<RollingStockPrivilege>;
}

impl TestClientExt for fga::Client {
    async fn subject_roles(&self, subject: &Subject) -> HashSet<Role> {
        match subject {
            Subject::User(user) => Role::list_roles(self, User::role(), user).await,
            Subject::Group(group) => Role::list_roles(self, Group::role(), group).await,
        }
        .unwrap()
        .into_iter()
        .collect()
    }

    async fn group_members(&self, group: &Group) -> HashSet<User> {
        self.list_users(Group::member().query_users(group))
            .await
            .unwrap()
            .users
            .into_iter()
            .collect()
    }

    async fn infra_effective_grant(&self, subject: Subject, infra: Infra) -> Option<InfraGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_effective_grant(subject, infra))
            .await
            .unwrap()
    }

    async fn infra_direct_grant(
        &self,
        subject: impl Into<Subject>,
        infra: Infra,
    ) -> Option<InfraGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_direct_grant(subject.into(), infra))
            .await
            .unwrap()
    }

    async fn infra_privileges(&self, user: User, infra: Infra) -> HashSet<InfraPrivilege> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_privileges(user, infra))
            .await
            .unwrap()
    }

    async fn rolling_stock_privileges(
        &self,
        user: User,
        rolling_stock: RollingStock,
    ) -> HashSet<RollingStockPrivilege> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(rolling_stock_privileges(user, rolling_stock))
            .await
            .unwrap()
    }
}
