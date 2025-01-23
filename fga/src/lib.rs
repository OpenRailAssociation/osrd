pub mod client;
pub mod model;

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
    use super::model::Relation;

    macro_rules! user {
        ($ty:ident, $namespace:literal) => {
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
            impl crate::model::Object for $ty {
                const NAMESPACE: &'static str = $namespace;
                fn id(&self) -> &str {
                    self.0.as_str()
                }
            }
        };
    }

    pub type Id = String;

    #[derive(Debug)]
    pub struct Role(pub Id);
    user!(Role, "role");

    #[derive(Debug)]
    pub struct User(pub Id);
    user!(User, "user");
    object!(User, "user");

    #[derive(Debug)]
    pub struct Group(pub Id);
    user!(Group, "group");
    object!(Group, "group");

    #[derive(Debug)]
    pub struct Infra(pub Id);
    object!(Infra, "infra");

    macro_rules! relation {
        ($name:ident : $user:ty => $object:ty) => {
            pub const fn $name() -> impl Relation<User = $user, Object = $object> {
                #[derive(Debug)]
                struct R;
                impl Relation for R {
                    const NAME: &'static str = stringify!($name);
                    type User = $user;
                    type Object = $object;
                }
                R
            }
        };
    }

    macro_rules! relations {
        ($($object:ty { $($name:ident : $user:ty),* }),*) => {
            $(
                impl $object {
                    $(
                        relation!($name: $user => $object);
                    )*
                }
            )*
        };
    }

    relations! {
        User {
            group: Group
        },
        Group {
            // role: Role,
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
