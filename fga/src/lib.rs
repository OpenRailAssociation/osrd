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
