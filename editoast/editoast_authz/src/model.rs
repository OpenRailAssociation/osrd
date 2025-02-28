#[derive(fga::Type, fga::User, fga::Object, derive_more::From, Debug)]
pub(crate) struct User(pub(crate) String);

#[derive(fga::Type, fga::User, fga::Object, derive_more::From, Debug)]
pub(crate) struct Group(pub(crate) String);

#[derive(fga::Type, fga::User, derive_more::From, Debug)]
pub(crate) struct Role(pub(crate) String);

fga::relations! {
    User {
        role: Role,
        group: Group
    },
    Group {
        role: Role,
        member: User
    }
}
