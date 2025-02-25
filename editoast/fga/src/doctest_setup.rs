use fga::model::Relation as _;

#[derive(Debug, PartialEq, Eq, fga::Type, fga::User, derive_more::From)]
struct Person(String);

#[derive(Debug, PartialEq, Eq, fga::Type, fga::User, fga::Object, derive_more::From)]
struct Group(String);

#[derive(Debug, PartialEq, Eq, fga::Type, fga::Object, derive_more::From)]
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
    fga::client::ConnectionSettings::new("localhost".to_string(), 8091).reset_store()
}
