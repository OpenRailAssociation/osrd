pub mod authorizer;
pub mod builtin_role;
pub mod roles;

pub use builtin_role::BuiltinRole;

#[cfg(any(test, feature = "fixtures"))]
pub mod fixtures {
    use strum::{AsRefStr, EnumString};

    use crate::roles::BuiltinRoleSet;

    #[derive(Debug, Clone, PartialEq, Eq, Hash, AsRefStr, EnumString)]
    #[strum(serialize_all = "snake_case")]
    pub enum TestBuiltinRole {
        DocRead,
        DocEdit,
        DocDelete,
        UserAdd,
        UserBan,
        Superuser,
    }

    impl BuiltinRoleSet for TestBuiltinRole {
        fn superuser() -> Self {
            Self::Superuser
        }
    }
}
