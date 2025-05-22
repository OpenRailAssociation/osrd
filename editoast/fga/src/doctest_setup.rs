use fga::model::Relation as _;
use fga::client::Limits;

#[derive(Debug, PartialEq, Eq, fga::Type, fga::User, derive_more::FromStr)]
struct Person(String);

#[derive(Debug, PartialEq, Eq, fga::Type, fga::User, fga::Object, derive_more::FromStr)]
struct Group(String);

#[derive(Debug, PartialEq, Eq, fga::Type, fga::Object, derive_more::FromStr)]
struct Document(String);

fga::relations! {
    Group {
        member: Person
    },
    Document {
        reader: Person,
        writer: Person,

        can_read: Person,
        can_write: Person
    }
}

fn settings() -> fga::client::ConnectionSettings {
    fga::client::ConnectionSettings::new("localhost".to_string(), 8091, Limits::default()).reset_store()
}
