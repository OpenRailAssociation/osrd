#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug)]
pub(crate) struct User(pub(crate) String);

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug, PartialEq, Eq, Hash)]
pub struct Group(pub i64);

#[derive(fga::Type, fga::User, fga::Object, derive_more::FromStr, Debug)]
pub(crate) struct Infra(pub(crate) String);

#[derive(fga::Type, fga::User, derive_more::FromStr, Debug)]
pub(crate) struct Role(pub(crate) String);

fga::relations! {
    User {
        role: Role,
        group: Group
    },
    Group {
        role: Role,
        member: User
    },
    Infra {
        reader: User,
        writer:User,
        owner: User,
        // Computed
        can_read: User,
        can_write: User,
        can_delete: User,
        can_share_read: User,
        can_share_write: User,
        can_share_ownership: User
    }
}
