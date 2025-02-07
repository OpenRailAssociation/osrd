#[derive(Debug)]
struct Person(String);

impl fga::model::User for Person {
    const NAMESPACE: &'static str = "person";
    fn id(&self) -> &str {
        self.0.as_str()
    }
}

#[derive(Debug)]
struct Document(String);

impl fga::model::Object for Document {
    const NAMESPACE: &'static str = "document";
    fn id(&self) -> &str {
        self.0.as_str()
    }
}

impl From<String> for Document {
    fn from(s: String) -> Self {
        Self(s)
    }
}

fga::relations! {
    Document {
        reader: Person,
        writer: Person,

        can_read: Person,
        can_write: Person
    }
}

use fga::model::Relation as _;
