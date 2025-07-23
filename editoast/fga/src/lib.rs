//! OpenFGA client library with type-safe types and relations
//!
//! # Content
//!
//! This library mainly provides two things:
//!
//! 1. A way to modelize OpenFGA objects and relations in a type-safe way. Types are regular Rust structures
//!    and relations are any type implementing the trait [model::Relation]. Are also provided a few macros
//!    to define and manipulate relations in a declarative way, close to OpenFGA syntax.
//! 2. A [client::Client] allowing to interact with an OpenFGA server **over HTTP only**. It doesn't cover all the
//!    OpenFGA API at the moment but the most common operations are implemented. This client supports the setup
//!    of stores and authorization models, writing tuples, performing queries such as permission checks, and more.
//!    The high-level API interfaces with the high-level modelization of OpenFGA objects and relations
//!    available in this library through the [model] module.
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
//! Derive macros [`User`] and [`Object`] are useful to define types, while [`relations!()`] helps generate
//! the relations implementations for several types at once. Finally, the [`fga!()`] macro helps manipulating
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
//! # use std::str::FromStr;
//! // Types
//! // -----------
//!
//! #[derive(Debug)]
//! struct Person(String);
//!
//! // how a Person is identified in OpenFGA's space
//! impl fga::model::Type for Person {
//!     const NAMESPACE: &'static str = "person";
//!
//!     fn id(&self) -> impl ToString {
//!        &self.0
//!     }
//! }
//!
//! // trait indicating that a Person can appear at the USER part of an OpenFGA tuple
//! impl fga::model::User for Person {}
//!
//! // needed to build back Persons from OpenFGA's responses (such as /list-users)
//! impl FromStr for Person {
//!     type Err = ();
//!     fn from_str(s: &str) -> Result<Self, Self::Err> {
//!         Ok(Self(s.to_owned()))
//!     }
//! }
//!
//! #[derive(Debug)]
//! struct Document(String);
//!
//! // how a Document is identified in OpenFGA's space
//! impl fga::model::Type for Document {
//!     const NAMESPACE: &'static str = "document";
//!
//!     fn id(&self) -> impl ToString {
//!        &self.0
//!     }
//! }
//!
//! // trait indicating that a Document can appear at the OBJECT part of an OpenFGA tuple
//! impl fga::model::Object for Document {}
//!
//! // needed to build back Documents from OpenFGA's responses (such as /list-objects)
//! impl FromStr for Document {
//!     type Err = ();
//!     fn from_str(s: &str) -> Result<Self, Self::Err> {
//!         Ok(Self(s.to_owned()))
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
//! # use fga::model::{Relation, User, Object, Type};
//! # #[derive(Debug, derive_more::FromStr)] struct Person(String);
//! # impl Type for Person { const NAMESPACE: &'static str = "person"; fn id(&self) -> impl ToString { &self.0 } }
//! # impl User for Person {}
//! # #[derive(Debug, derive_more::FromStr)] struct Document(String);
//! # impl Type for Document { const NAMESPACE: &'static str = "document"; fn id(&self) -> impl ToString { &self.0 } }
//! # impl Object for Document {}
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
//! let public = DocumentReader.tuple(User::wildcard(), &Document("public".to_string()));
//!
//! // a check for permission
//! let bob_can_read = DocumentCanRead.check(&bob, &doc);
//!
//! // a query for related objects
//! let bobs_docs = DocumentReader.query_objects(&bob);
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
//! For the derive macros [`fga::User`](User) and [`fga::Type`](Type), it is recommended to use the `derive_more::FromStr` derive
//! macro to generate the `FromStr` implementation required by [`trait User`](model::User) and [`trait Object`](model::Object).
//!
//! ```
//! #[derive(fga::Type, fga::User, derive_more::FromStr, Debug)]
//! struct Person(String);
//!
//! #[derive(fga::Type, fga::Object, derive_more::FromStr, Debug)]
//! struct Document(String);
//!
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
//! the [`fga!()`] macro for this purpose. It tries to stick as much as possible to OpenFGA's syntax for users, objects
//! and tuples.
//!
//! ```
//! # use fga::fga;
//! # use fga::model::{Relation, User, Object};
//! # include!("doctest_setup.rs");
//! # fn main() {
//! let bob = fga!(Person:"bob");
//! let doc = fga!(Document:"2021-budget");
//!
//! let tuple = fga!(Document:"2021-budget"#reader@Person:"bob");
//! let public = fga!(Document:"public"#reader@Person:*);
//! # }
//! ```
//!
//! # The HTTP client
//!
//! The crate provides an HTTP client to interact with an OpenFGA server. It exposes an high-level API
//! that interfaces with the high-level type-safe modelization types of the OpenFGA authorization model
//! defined in [`mod model`].
//!
//! Note that the [`client::Client`] doesn't yet cover the whole OpenFGA API. That may come in the future
//! according to OSRD's needs.
//!
//! Consult the [`struct Client`](client::Client) documentation for more information.

pub mod client;
pub mod model;

use client::AuthorizationModel;
pub use client::Client;

pub use fga_derive::Object;
pub use fga_derive::Type;
pub use fga_derive::User;

/// A little DSL to define the OpenFGA relations of an object in a somewhat similar way to the OpenFGA model syntax
///
/// # Example
///
/// ```
/// # include!("doctest_setup.rs");
/// # use fga::relations;
/// # impl fga::model::Object for Person {}
/// relations! {
///     Person {
///         friend: Person
///     },
///     Document {
///         owner: Person,
///         can_delete: Person
///     }
/// }
/// # fn main() {}
/// ```
///
/// This will generate the following methods:
///
/// ```ignore
/// impl User {
///     pub const fn friend() -> impl Relation<User = Person, Object = Person>;
/// }
///
/// impl Document {
///     pub const fn owner() -> impl Relation<User = Person, Object = Document>;
///     pub const fn can_delete() -> impl Relation<User = Person, Object = Document>;
/// }
/// ```
///
/// Consult macro expansion and crate documentation for more information.
#[macro_export]
macro_rules! relations {
    ($($object:ty { $($name:ident : $user:ty),* }),*) => {
        $(
            impl $object {
                $(
                    #[allow(unused)]
                    pub const fn $name() -> impl $crate::model::Relation<User = $user, Object = $object> {
                        #[derive(Debug)]
                        struct R;
                        impl $crate::model::Relation for R {
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

/// Compiles an OpenFGA authorization model defined using OpenFGA's DSL into JSON
///
/// **The model is assumed to be valid! This function panics otherwise.**
///
/// The `fga` binary must be installed and available in the `$PATH`. It's
/// available at <https://github.com/openfga/cli>.
///
/// This function is mostly meant to be used in unit tests.
///
/// # Panics
///
/// This function will panic if:
/// - A temporary file cannot be created or written to.
/// - The `fga` command fails to execute (errored model or binary not in `$PATH`).
pub fn compile_model(model: &str) -> AuthorizationModel {
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

/// Type-safe OpenFGA literals
///
/// # Supported syntaxes
///
/// ```rust
/// # include!("doctest_setup.rs");
/// # fn main() {
/// # use fga::fga;
/// # use fga::model::{Relation, User, Object};
/// // User and objects literals
/// let alice = fga!(Person:"alice");
/// let doc = fga!(Document:"2021-budget");
/// assert_eq!(alice, Person("alice".to_string()));
/// assert_eq!(doc, Document("2021-budget".to_string()));
///
/// // Type-bound public access
/// let everyone = fga!(Person:*);
/// assert_eq!(everyone, Person::wildcard());
///
/// // Usersets
/// assert_eq!(
///     fga!(Document:"topsecret"#reader),
///     Document::reader().userset(&Document("topsecret".to_string()))
/// );
///
/// // Simple tuples
/// assert_eq!(
///     fga!(Document:"2021-budget"#reader@Person:"alice"),
///     Document::reader()
///         .tuple(&Person("alice".to_string()), &Document("2021-budget".to_string()))
/// );
///
/// // Tuples with type-bound public access
/// assert_eq!(
///     fga!(Document:"2021-budget"#reader@Person:*),
///     Document::reader()
///         .tuple(Person::wildcard(), &Document("2021-budget".to_string()))
/// );
///
/// // Tuples with usersets
/// assert_eq!(
///     fga!(Document:"2021-budget"#reader@Document:"topsecret"#can_write),
///     Document::reader()
///         .tuple(
///             Document::can_write().userset(&Document("topsecret".to_string())),
///             &Document("2021-budget".to_string())
///         )
/// );
/// # }
/// ```
///
/// # About temporary references
///
/// ```compile_fail
/// # include!("doctest_setup.rs");
/// # fn main() {
/// # use fga::fga;
/// # use fga::model::{Relation, User, Object};
/// let userset = fga!(Document:"topsecret"#reader); // creates a temporary value which is freed while still in use
/// println!("{userset:?}");
/// # }
/// ```
///
/// This is expected since the [model::Relation] API doesn't take ownership of users and objects to
/// build compound objects (such as tuples, queries, usersets, etc.). In the previous example, the "temporary value"
/// refers to the `Document("topsecret")`. If we inlined the userset, there wouldn't be any issue (so nothing to worry
/// about if the value is directly sent to the [client::Client]).
///
/// To circumvent this issue, the following syntaxes are supported:
///
/// ```rust
/// # include!("doctest_setup.rs");
/// # fn main() {
/// # use fga::fga;
/// # use fga::model::{Relation, User, Object};
/// // Usersets
/// let secret = fga!(Document:"topsecret");
/// let userset = fga!(Document:secret # reader);
/// println!("{userset:?}");
///
/// // Simple tuples
/// let alice = fga!(Person:"alice");
/// let tuple = fga!(Document:secret # reader @ alice);
/// println!("{tuple:?}");
///
/// // Types with variables implementing ToString
/// let user_id = 42i32;
/// let user = fga!(Person:user_id);
/// println!("{user:?}");
/// # }
/// ```
#[macro_export]
macro_rules! fga {
    // User notations
    // --------------

    // fga!(User:"bob") => "user:bob"
    ($ty:ident : $id:literal) => {
        <$ty as std::str::FromStr>::from_str(&$id.to_string()).unwrap()
    };

    ($ty:ident : $var:ident) => {
        <$ty as std::str::FromStr>::from_str(&$var.to_string()).unwrap()
    };

    // fga!(User:*) => "user:*"
    ($ty:ident : *) => {
        <$ty as $crate::model::User>::wildcard()
    };

    // fga!(Group:"my_friends"#member) => userset syntax "group:my_friends#member"
    ($ty:ident : $id:literal # $relation:ident) => {
        $crate::model::Relation::userset(&$ty::$relation(), &fga!($ty:$id))
    };

    ($ty:ident : $var:ident # $relation:ident) => {
        $crate::model::Relation::userset(&$ty::$relation(), &$var)
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
        $object::$relation().tuple(fga!($user:*), &fga!($object:$object_id))
    };

    // fga!(doc:id#reader@group#member) => tuple syntax for user set
    ($object:ident : $object_id:literal # $relation:ident @ $user:ident : $user_id:literal # $user_relation:ident) => {
        $object::$relation().tuple(fga!($user:$user_id # $user_relation), &fga!($object:$object_id))
    };

    ($object:ident : $object_var:ident # $relation:ident @ $user_var:ident) => {
        $object::$relation().tuple(&$user_var, &$object_var)
    };
}

#[cfg(any(test, feature = "test_utilities"))]
pub mod test_utilities {
    use url::Url;

    use super::*;

    /// The [client::ConnectionSettings] to use for unit and doc tests
    ///
    /// Configurable through the `FGA_API_URL`, `OPENFGA_MAX_CHECKS_PER_BATCH_CHECK` and
    /// `OPENFGA_MAX_TUPLES_PER_WRITE` environment variables.
    /// Defaults to `http://localhost:8091` and the OpenFGA server default limits.
    pub fn connection_settings() -> client::ConnectionSettings {
        use client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
        use client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
        use client::Limits;

        let openfga_url = Url::parse(
            &std::env::var("FGA_API_URL").unwrap_or_else(|_| "http://localhost:8091".to_string()),
        )
        .expect("invalid FGA_API_URL");
        let max_checks_per_batch_check = std::env::var("OPENFGA_MAX_CHECKS_PER_BATCH_CHECK")
            .map(|tuple_reads| tuple_reads.parse::<u32>().expect("invalid max tuple reads"))
            .unwrap_or(DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK);
        let max_tuples_per_write = std::env::var("OPENFGA_MAX_TUPLES_PER_WRITE")
            .map(|tuple_writes| {
                tuple_writes
                    .parse::<u64>()
                    .expect("invalid max tuple reads")
            })
            .unwrap_or(DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE);

        client::ConnectionSettings::new(
            openfga_url,
            Limits {
                max_checks_per_batch_check,
                max_tuples_per_write,
            },
        )
        .reset_store()
    }

    #[macro_export]
    /// Create a store named after the function calling the macro and return a client connected to
    /// that store.
    macro_rules! test_client {
        () => {
            $crate::test_client!("")
        };
        ($store_prefix:literal) => {
            $crate::client::Client::try_new_store(
                &$crate::test_utilities::sanitize_store_name_length(&format!(
                    "{}{}",
                    $store_prefix.to_string(),
                    stdext::function_name!()
                        .split("::")
                        .filter(|x| *x != "{{closure}}")
                        .collect::<Vec<_>>()
                        .join("-")
                )),
                $crate::test_utilities::connection_settings(),
            )
            .await
            .expect("Failed to initialize client")
        };
    }

    pub fn sanitize_store_name_length(store_name: &str) -> String {
        const OPENFGA_STORE_NAME_MIN_LEN: usize = 3;
        const OPENFGA_STORE_NAME_MAX_LEN: usize = 64;
        match store_name.to_string() {
            name if name.len() < OPENFGA_STORE_NAME_MIN_LEN => {
                let suffix = "_".repeat(OPENFGA_STORE_NAME_MIN_LEN - name.len());
                name + suffix.as_str()
            }
            name if name.len() > OPENFGA_STORE_NAME_MAX_LEN => name
                .chars()
                .take(OPENFGA_STORE_NAME_MAX_LEN)
                .collect::<String>(),
            name => name,
        }
    }
}

#[cfg(test)]
mod defs {
    // We can't use the derive macros `fga::Type`, `fga::User` and `fga::Object` in the tests
    // as we're still in the `fga` crate.
    macro_rules! fga_type {
        (@ $vis:vis struct $name:ident $ns:literal) => {
            #[derive(Debug, derive_more::FromStr, PartialEq, Eq, PartialOrd, Ord, Clone)]
            pub struct $name(pub String);
            #[automatically_derived]
            impl crate::model::Type for $name {
                const NAMESPACE: &'static str = $ns;
                fn id(&self) -> impl ToString {
                    &self.0
                }
            }
        };
        (@ $name:ident : User) => {
            #[automatically_derived]
            impl crate::model::User for $name {}
        };
        (@ $name:ident : Object) => {
            #[automatically_derived]
            impl crate::model::Object for $name {}
        };
        ($vis:vis struct $name:ident($ns:literal) : $($derive:ident),+) => {
            fga_type!(@ $vis struct $name $ns);
            $(fga_type!(@ $name : $derive);)*

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
            role: Role,
            group: Group,
            manager: User
        },
        Group {
            role: Role,
            member: User,
            manager: User
        },
        Infra {
            reader: User,
            writer: User,
            can_read: User,
            can_write: User
        }
    }
}
