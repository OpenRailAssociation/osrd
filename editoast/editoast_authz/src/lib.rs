pub mod authorizer;
pub mod builtin_role;
pub mod roles;

pub use builtin_role::BuiltinRole;

#[cfg(any(test, feature = "fixtures"))]
pub mod fixtures {
    use strum::{AsRefStr, EnumString};

    use crate::roles::{self, RoleConfig};

    #[derive(Debug, Clone, PartialEq, Eq, Hash, AsRefStr, EnumString)]
    #[strum(serialize_all = "snake_case")]
    pub enum TestBuiltinRole {
        DocRead,
        DocEdit,
        DocDelete,
        UserAdd,
        UserBan,
    }

    impl roles::BuiltinRoleSet for TestBuiltinRole {
        fn implies_iter(&self) -> impl IntoIterator<Item = Self> {
            match self {
                Self::DocRead => vec![],
                Self::DocEdit => vec![Self::DocRead],
                Self::DocDelete => vec![Self::DocEdit],
                Self::UserAdd => vec![],
                Self::UserBan => vec![],
            }
        }
    }

    pub fn default_test_config() -> roles::RoleConfig<TestBuiltinRole> {
        const SOURCE: &str = r#"
            [roles.doc_reader]
            implies = ["doc_read"]

            [roles.doc_provider]
            implies = ["doc_delete", "doc_edit", "doc_read"]

            [roles.admin]
            implies = ["user_add", "user_ban"]

            [roles.dev]
            implies = ["admin", "doc_provider"]
        "#;
        RoleConfig::load(SOURCE).expect("should parse successfully")
    }
}
