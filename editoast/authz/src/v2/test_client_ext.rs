use std::collections::HashSet;

use fga::fga;
use fga::model::Relation as _;

use crate::Group;
use crate::Infra;
use crate::InfraGrant;
use crate::InfraPrivilege;
use crate::Role;
use crate::RollingStock;
use crate::RollingStockGrant;
use crate::Subject;
use crate::User;
use crate::model::RollingStockPrivilege;
use crate::v2::ResourcesList;
use crate::v2::infra_direct_grant;
use crate::v2::infra_effective_grant;
use crate::v2::infra_granted_subjects;
use crate::v2::infra_privileges;
use crate::v2::infra_revoke_grant;
use crate::v2::infra_set_grant;
use crate::v2::rolling_stock_direct_grant;
use crate::v2::rolling_stock_effective_grant;
use crate::v2::rolling_stock_granted_subjects;
use crate::v2::rolling_stock_privileges;
use crate::v2::rolling_stock_revoke_grant;
use crate::v2::special_authorizers;
use crate::v2::user_groups;

pub trait TestClientExt {
    async fn subject_roles(&self, subject: &Subject) -> HashSet<Role>;
    async fn group_members(&self, group: &Group) -> HashSet<User>;
    async fn user_groups(&self, user: User) -> HashSet<Group>;

    async fn infra_effective_grant(&self, subject: Subject, infra: Infra) -> Option<InfraGrant>;
    async fn infra_direct_grant(
        &self,
        subject: impl Into<Subject>,
        infra: Infra,
    ) -> Option<InfraGrant>;
    async fn infra_set_grant(&self, subject: Subject, infra: Infra, grant: InfraGrant);
    async fn infra_revoke_grant(&self, subject: Subject, infra: Infra) -> bool;
    async fn infra_privileges(&self, user: User, infra: Infra) -> HashSet<InfraPrivilege>;
    async fn infra_granted_subjects(&self, infra: Infra, grant: InfraGrant) -> Vec<Subject>;
    async fn infra_list(&self, user: User, privilege: InfraPrivilege) -> ResourcesList<Infra>;
    async fn rolling_stock_revoke_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> bool;
    async fn rolling_stock_privileges(
        &self,
        user: User,
        rolling_stock: RollingStock,
    ) -> HashSet<RollingStockPrivilege>;
    async fn rolling_stock_effective_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> Option<RollingStockGrant>;
    async fn rolling_stock_direct_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> Option<RollingStockGrant>;
    async fn rolling_stock_granted_subjects(
        &self,
        rolling_stock: RollingStock,
        grant: RollingStockGrant,
    ) -> Vec<Subject>;
    // TODO use the protected operation once authz::v2 has a proper way to give grants on rolling stocks
    async fn give_rolling_stock_grant(
        &self,
        rolling_stock: RollingStock,
        subject: Subject,
        grant: RollingStockGrant,
    );
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

    async fn user_groups(&self, user: User) -> HashSet<Group> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(user_groups(user))
            .await
            .unwrap()
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

    async fn rolling_stock_direct_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> Option<RollingStockGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(rolling_stock_direct_grant(subject, rolling_stock))
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

    async fn infra_set_grant(&self, subject: Subject, infra: Infra, grant: InfraGrant) {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_set_grant(subject, infra, grant))
            .await
            .unwrap()
    }

    async fn infra_revoke_grant(&self, subject: Subject, infra: Infra) -> bool {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_revoke_grant(subject, infra))
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

    async fn infra_granted_subjects(&self, infra: Infra, grant: InfraGrant) -> Vec<Subject> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_granted_subjects(infra, grant))
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
    async fn rolling_stock_effective_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> Option<RollingStockGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(rolling_stock_effective_grant(subject, rolling_stock))
            .await
            .unwrap()
    }
    async fn rolling_stock_granted_subjects(
        &self,
        rolling_stock: RollingStock,
        grant: RollingStockGrant,
    ) -> Vec<Subject> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(rolling_stock_granted_subjects(rolling_stock, grant))
            .await
            .unwrap()
    }
    async fn rolling_stock_revoke_grant(
        &self,
        subject: Subject,
        rolling_stock: RollingStock,
    ) -> bool {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(rolling_stock_revoke_grant(subject, rolling_stock))
            .await
            .unwrap()
    }
    async fn give_rolling_stock_grant(
        &self,
        rolling_stock: RollingStock,
        subject: Subject,
        grant: RollingStockGrant,
    ) {
        match (grant, subject) {
            (RollingStockGrant::Reader, Subject::User(user)) => {
                self.write_tuples(&[RollingStock::reader()
                    .tuple(&fga!(User:user), &fga!(RollingStock:rolling_stock))])
                    .await
            }
            (RollingStockGrant::Writer, Subject::User(user)) => {
                self.write_tuples(&[RollingStock::writer()
                    .tuple(&fga!(User:user), &fga!(RollingStock:rolling_stock))])
                    .await
            }
            (RollingStockGrant::Owner, Subject::User(user)) => {
                self.write_tuples(&[RollingStock::owner()
                    .tuple(&fga!(User:user), &fga!(RollingStock:rolling_stock))])
                    .await
            }
            (RollingStockGrant::Reader, Subject::Group(group)) => {
                self.prepare_writes()
                    .write(
                        &RollingStock::reader()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    )
                    .execute()
                    .await
            }
            (RollingStockGrant::Writer, Subject::Group(group)) => {
                self.prepare_writes()
                    .write(
                        &RollingStock::writer()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    )
                    .execute()
                    .await
            }
            (RollingStockGrant::Owner, Subject::Group(group)) => {
                self.prepare_writes()
                    .write(
                        &RollingStock::owner()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    )
                    .execute()
                    .await
            }
        }
        .unwrap()
    }

    async fn infra_list(&self, user: User, privilege: InfraPrivilege) -> ResourcesList<Infra> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(crate::v2::infra::infra_list(user, privilege))
            .await
            .unwrap()
    }
}
