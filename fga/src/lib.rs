//! OpenFGA client library with type-safe types and relations
//!
//! # Content
//!
//! This library mainly provides two things:
//!
//! 1. A way to modelize OpenFGA objects and relations in a type-safe way. Types are regular Rust structures
//!     and relations are any type implementing the trait [model::Relation]. Are also provided a few macros
//!     to define and manipulate relations in a declarative way, close to OpenFGA syntax.
//! 2. A [client::Client] allowing to interact with an OpenFGA server **over HTTP only**. It doesn't cover all the
//!     OpenFGA API at the moment but the most common operations are implemented. This client supports the setup
//!     of stores and authorization models, writing tuples, performing queries such as permission checks, and more.
//!     The high-level API interfaces with the high-level modelization of OpenFGA objects and relations
//!     available in this library through the [model] module.
//!
//! # High-level modelization of OpenFGA objects
//!
//! Available in the [model] module, this part of the library provides a way to modelize OpenFGA objects and
//! relations in a type-safe way.
//!
//! OpenFGA types are any Rust type that can store an ID as a string, corresponding to the second part of
//! OpenFGA identifiers such as `document:2021-budget`. If a type implements the [model::Object] trait, it can
//! appear in the OBJECT part of an OpenFGA tuple. If it implements the [model::User] trait, it can appear
//! in the USER part of an OpenFGA tuple. Both can be implemented for any given type.
//!
//! OpenFGA relations are any type implementing the [model::Relation] trait. Everything is set up using
//! the associated types of this trait: [model::Relation::User] and [model::Relation::Object]. The trait
//! provides default methods to use the relation in various ways, such as checking permissions, querying
//! related objects, and more.
//!
//! To help with the definition of OpenFGA relations, this library provides a few macros to define relations.
//! Derive macros `UserTODO` and `ObjectTODO` are useful to define types, while [relations] helps generate
//! the relations implementations for several types at once. Finally, the `fga` macro helps manipulating
//! OpenFGA objects and tuples in a concise way, as having concise literals in tests is valuable.
//!
//! ## Minimal example
//!
//! As an example, lets consider the following simple OpenFGA authorization model:
//!
//! ```custom
//! type person
//!
//! type document
//!     relations
//!         define reader: [person, person:*] # a document can be publicly available for consultation
//!         define can_read: reader
//! ```
//!
//! A definition of this model in Rust looks like this:
//!
//! ```rust
//! // Types
//! // -----------
//!
//! #[derive(Debug)]
//! struct Person(String);
//!
//! impl fga::model::User for Person {
//!     const NAMESPACE: &'static str = "person";
//!
//!     fn id(&self) -> &str {
//!        self.0.as_str()
//!     }
//! }
//!
//! #[derive(Debug)]
//! struct Document(String);
//!
//! impl fga::model::Object for Document {
//!     const NAMESPACE: &'static str = "document";
//!
//!     fn id(&self) -> &str {
//!        self.0.as_str()
//!     }
//! }
//!
//! // required by trait Object
//! impl From<String> for Document {
//!     fn from(s: String) -> Self {
//!         Self(s)
//!     }
//! }
//!
//! // Relations
//! // -----------
//!
//! #[derive(Debug)]
//! struct DocumentReader;
//!
//! impl fga::model::Relation for DocumentReader {
//!     const NAME: &'static str = "reader";
//!     type User = Person;
//!     type Object = Document;
//! }
//!
//! #[derive(Debug)]
//! struct DocumentCanRead;
//!
//! impl fga::model::Relation for DocumentCanRead {
//!     const NAME: &'static str = "can_read";
//!     type User = Person;
//!     type Object = Document;
//! }
//! ```
//!
//! We can then leverage these definitions to use OpenFGA in a type-safe way.
//!
//! ```rust
//! # use fga::model::{Relation, User, Object};
//! # #[derive(Debug)] struct Person(String);
//! # impl User for Person { const NAMESPACE: &'static str = "person"; fn id(&self) -> &str { self.0.as_str() } }
//! # #[derive(Debug)] struct Document(String);
//! # impl Object for Document { const NAMESPACE: &'static str = "document"; fn id(&self) -> &str { self.0.as_str() } }
//! # impl From<String> for Document { fn from(s: String) -> Self { Self(s) } }
//! # #[derive(Debug)] struct DocumentReader;
//! # impl Relation for DocumentReader { const NAME: &'static str = "reader"; type User = Person; type Object = Document; }
//! # #[derive(Debug)] struct DocumentCanRead;
//! # impl Relation for DocumentCanRead { const NAME: &'static str = "can_read"; type User = Person; type Object = Document; }
//! let bob = Person("bob".to_string());
//! let doc = Document("2021-budget".to_string());
//!
//! // a tuple
//! let tuple = DocumentReader.tuple(&bob, &doc);
//!
//! // the opposite fails to compile thanks to type safety
//! // let wrong_tuple = DocumentReader.tuple(&doc, &bob);
//!
//! // type-bound public access support
//! let public = DocumentReader.tuple(&User::tbpa(), &Document("public".to_string()));
//!
//! // a check for permission
//! let bob_can_read = DocumentCanRead.check(&bob, &doc);
//!
//! // a query for related objects
//! let bobs_docs = DocumentReader.query_objects_stored(&bob);
//! ```
//!
//! These objects obtained from using the relations can be used in the HTTP client to interact with an OpenFGA
//! server. More about this below.
//!
//! ## A more concise syntax
//!
//! ### Authorization model definitions
//!
//! This library provides a bunch of macros to define types, relations and OpenFGA objects in a more concise way.
//! We tried to stay as close as possible / necessary to OpenFGA syntaxes.
//!
//! ```ignore
//! #[derive(Debug, fga::User)]
//! #[fga(namespace = "person")]
//! struct Person(String);
//!
//! #[derive(Debug, fga::Object)]
//! #[fga(namespace = "document")]
//! struct Document(String);
//! ```
//! ```
//! # #[derive(Debug)] struct Person(String);
//! # impl fga::model::User for Person { const NAMESPACE: &'static str = "person"; fn id(&self) -> &str { self.0.as_str() } }
//! # #[derive(Debug)] struct Document(String);
//! # impl fga::model::Object for Document { const NAMESPACE: &'static str = "document"; fn id(&self) -> &str { self.0.as_str() } }
//! # impl From<String> for Document { fn from(s: String) -> Self { Self(s) } }
//! fga::relations! {
//!     Document {
//!         reader: Person,
//!         can_read: Person
//!     }
//! }
//! ```
//!
//! The only difference with the previous example is that relations are now accessible through the `Document` namespace
//! as `const` associated functions. For example:
//!
//! ```
//! # include!("doctest_setup.rs");
//! # fn main() {
//! # let bob = Person("bob".to_string());
//! # let doc = Document("2021-budget".to_string());
//! let tuple = Document::reader().tuple(&bob, &doc);
//! # }
//! ```
//!
//! ### OpenFGA literals
//!
//! In a test context, it's useful to be able to write OpenFGA literals in a concise way. This library provides
//! the `fga` macro for this purpose. It tries to stick as much as possible to OpenFGA's syntax for USERs, OBJECTTs
//! and tuples.
//!
//! <div class="warning">TODO: fix example</div>
//!
//! ```ignore
//! # use fga::fga;
//! # use fga::model::{Relation, User, Object};
//! # #[derive(Debug)] struct Person(String);
//! # impl User for Person { const NAMESPACE: &'static str = "person"; fn id(&self) -> &str { self.0.as_str() } }
//! # #[derive(Debug)] struct Document(String);
//! # impl Object for Document { const NAMESPACE: &'static str = "document"; fn id(&self) -> &str { self.0.as_str() } }
//! # impl From<String> for Document { fn from(s: String) -> Self { Self(s) } }
//! # fga::relations! { Document { reader: Person, can_read: Person } }
//! let bob = fga!(Person:"bob");
//! let doc = fga!(Document:"2021-budget");
//!
//! let tuple = fga!(Document:"2021-budget"#reader@Person:"bob");
//! let public = fga!(Document:"public"#reader@Person:*);
//! ```
//!
//! # The HTTP client
//!
//! TODO
//!
//! <div class="warning">
//! /!\ TODO /!\
//! ------------
//!
//! Prevent tuples with plain `impl User` to be written with an "*" ID. Unless `Tbpa`
//! is explicitly used, no public access should be granted.
//! </div>

pub mod client;
pub mod model;

/// A little DSL to define the OpenFGA relations of an object in a somewhat similar way to the OpenFGA model syntax
///
/// # Example
///
/// ```ignore
/// relations! {
///     User {
///         group: Group
///     },
///     Group {
///         member: User
///     },
///     Document {
///         reader: User,
///         can_read: User
///     }
/// }
/// ```
///
/// This will generate the following methods:
///
/// ```ignore
/// impl User {
///     pub const fn group() -> impl Relation<User = User, Object = Group>;
/// }
///
/// impl Group {
///     pub const fn member() -> impl Relation<User = User, Object = Group>;
/// }
///
/// impl Document {
///     pub const fn reader() -> impl Relation<User = User, Object = Document>;
///     pub const fn can_read() -> impl Relation<User = User, Object = Document>;
/// }
/// ```
///
/// Consult macro expansion for more information.
#[cfg(not(test))]
#[macro_export]
macro_rules! relations {
    ($($object:ty { $($name:ident : $user:ty),* }),*) => {
        $(
            impl $object {
                $(
                    #[allow(unused)]
                    pub const fn $name() -> impl fga::model::Relation<User = $user, Object = $object> {
                        #[derive(Debug)]
                        struct R;
                        impl fga::model::Relation for R {
                            const NAME: &'static str = stringify!($name);
                            type User = $user;
                            type Object = $object;
                        }
                        R
                    }
                )*
            }
        )*
    };
}

// Duplicated because we want to use it in the tests of this crate (cf. qualified Relation path)
#[cfg(test)]
macro_rules! relations {
    ($($object:ty { $($name:ident : $user:ty),* }),*) => {
        $(
            impl $object {
                $(
                    #[allow(unused)]
                    pub const fn $name() -> impl crate::model::Relation<User = $user, Object = $object> {
                        #[derive(Debug)]
                        struct R;
                        impl Relation for R {
                            const NAME: &'static str = stringify!($name);
                            type User = $user;
                            type Object = $object;
                        }
                        R
                    }
                )*
            }
        )*
    };
}

#[cfg(test)]
fn compile_model(model: &str) -> serde_json::Value {
    use std::process::Command;

    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("model.fga");
    std::fs::write(&file, model).unwrap();
    // requires https://github.com/openfga/cli
    let json = Command::new("fga")
        .arg("model")
        .arg("transform")
        .arg("--input-format")
        .arg("fga")
        .arg("--file")
        .arg(file)
        .output()
        .expect("should work—is `fga` CLI installed and in $PATH? https://github.com/openfga/cli")
        .stdout;
    serde_json::from_slice(json.as_slice()).expect("invalid fga transform output")
}

#[cfg(test)]
mod defs {
    use derive_more::From;

    use super::model::Relation;

    macro_rules! fga_type {
        (@ $vis:vis struct $name:ident) => {
            #[derive(Debug, From, PartialEq, Eq, PartialOrd, Ord, Clone)]
            pub struct $name(#[from] pub String);
        };
        (@ $name:ident : User($ns:literal)) => {
            #[automatically_derived]
            impl crate::model::User for $name {
                const NAMESPACE: &'static str = $ns;
                fn id(&self) -> &str {
                    self.0.as_str()
                }
            }
        };
        (@ $name:ident : Object($ns:literal)) => {
            #[automatically_derived]
            impl crate::model::Object for $name {
                const NAMESPACE: &'static str = $ns;
                fn id(&self) -> &str {
                    self.0.as_str()
                }
            }
        };
        ($vis:vis struct $name:ident($ns:literal) : $($derive:ident),+) => {
            fga_type!(@ $vis struct $name);
            $(fga_type!(@ $name : $derive($ns));)*

            #[allow(unused)]
            macro_rules! $name {
                ($s:literal) => {
                    $name($s.to_string())
                };
            }
        };
    }

    fga_type!(pub struct Role("role"): User);
    fga_type!(pub struct User("user"): User, Object);
    fga_type!(pub struct Group("group"): User, Object);
    fga_type!(pub struct Infra("infra"): Object);

    relations! {
        User {
            group: Group
        },
        Group {
            role: Role,
            member: User
        },
        Infra {
            reader: User,
            can_read: User
        }
    }
}

#[cfg(test)]
macro_rules! fga {
    // User notations
    // --------------

    // fga!(User:"bob") => "user:bob"
    ($ty:ident : $id:literal) => {
        $ty($id.to_string())
    };

    // fga!(User:*) => "user:*"
    ($ty:ident : *) => {
        <$ty as crate::model::User>::tbpa()
    };

    // fga!(Group:"my_friends"#member) => userset syntax "group:my_friends#member"
    ($ty:ident : $id:literal # $relation:ident) => {
        {
            use crate::model::Relation as _;
            $ty::$relation().userset(&fga!($ty:$id))
        }
    };

    // Tuple notations
    // ---------------

    // fga!(doc:id#reader@user:id) => tuple syntax
    //
    // Read it backwards: "the user of type 'user' with this id is a reader of this doc with that id"
    ($object:ident : $object_id:literal # $relation:ident @ $user:ident : $user_id:literal) => {
        $object::$relation().tuple(&fga!($user:$user_id), &fga!($object:$object_id))
    };

    // fga!(group:id#member@user:*) => tuple syntax for public type access bounds
    ($object:ident : $object_id:literal # $relation:ident @ $user:ident : *) => {
        $object::$relation().tuple(&fga!($user:*), &fga!($object:$object_id))
    };

    // fga!(doc:id#reader@group#member) => tuple syntax for user set
    ($object:ident : $object_id:literal # $relation:ident @ $user:ident : $user_id:literal # $user_relation:ident) => {
        $object::$relation().tuple(&fga!($user:$user_id # $user_relation), &fga!($object:$object_id))
    };
}

#[cfg(test)]
pub(crate) use fga;
