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

    macro_rules! user {
        ($ty:ident, $namespace:literal) => {
            #[automatically_derived]
            impl crate::model::User for $ty {
                const NAMESPACE: &'static str = $namespace;
                fn id(&self) -> &str {
                    self.0.as_str()
                }
            }
        };
    }

    macro_rules! object {
        ($ty:ident, $namespace:literal) => {
            #[automatically_derived]
            impl crate::model::Object for $ty {
                const NAMESPACE: &'static str = $namespace;
                fn id(&self) -> &str {
                    self.0.as_str()
                }
            }
        };
    }

    pub type Id = String;

    #[derive(Debug, From, PartialEq, Eq, PartialOrd, Ord)]
    pub struct Role(#[from] pub Id);
    user!(Role, "role");

    #[derive(Debug, From, PartialEq, Eq, PartialOrd, Ord)]
    pub struct User(#[from] pub Id);
    user!(User, "user");
    object!(User, "user");

    #[derive(Debug, From, PartialEq, Eq, PartialOrd, Ord)]
    pub struct Group(#[from] pub Id);
    user!(Group, "group");
    object!(Group, "group");

    #[derive(Debug, From, PartialEq, Eq, PartialOrd, Ord)]
    pub struct Infra(#[from] pub Id);
    object!(Infra, "infra");

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
macro_rules! s {
    () => {
        "j'apprécie les fruits au sirop".to_string()
    };
    ($s:literal) => {
        $s.to_string()
    };
}

#[cfg(test)]
pub(crate) use s;
