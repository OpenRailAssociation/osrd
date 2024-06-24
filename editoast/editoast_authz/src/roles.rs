use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};

pub trait BuiltinRoleSet:
    FromStr + AsRef<str> + Sized + Clone + std::hash::Hash + std::cmp::Eq + std::fmt::Debug
{
    fn implies_iter(&self) -> impl IntoIterator<Item = Self>;

    fn as_str(&self) -> &str {
        self.as_ref()
    }
}

pub type RoleIdentifier = String;

#[derive(Debug)]
pub struct RoleConfig<B: BuiltinRoleSet> {
    #[allow(unused)]
    pub(crate) superuser: bool,
    pub(crate) resolved_roles: HashMap<RoleIdentifier, HashSet<B>>,
}

impl<B: BuiltinRoleSet> RoleConfig<B> {
    pub fn new_superuser() -> Self {
        Self {
            superuser: true,
            resolved_roles: Default::default(),
        }
    }

    pub fn new(resolved_roles: HashMap<RoleIdentifier, HashSet<B>>) -> Self {
        Self {
            superuser: false,
            resolved_roles,
        }
    }

    pub fn is_superuser(&self) -> bool {
        self.superuser
    }

    pub fn resolve<'r>(
        &self,
        app_roles: impl Iterator<Item = &'r RoleIdentifier>,
    ) -> Result<HashSet<B>, &'r RoleIdentifier> {
        let mut resolved = HashSet::new();
        for role in app_roles {
            if let Some(role) = self.resolved_roles.get(role) {
                resolved.extend(role.iter().cloned());
            } else {
                return Err(role);
            }
        }
        Ok(resolved)
    }

    #[tracing::instrument(err)]
    pub fn load(source: &str) -> Result<Self, RoleConfigParsingError> {
        #[derive(serde::Deserialize)]
        struct ApplicationRole {
            implies: Vec<RoleIdentifier>,
        }

        #[derive(serde::Deserialize)]
        struct Config {
            roles: HashMap<RoleIdentifier, ApplicationRole>,
        }

        impl Config {
            fn validate(&self) -> Result<(), RoleConfigParsingError> {
                for role in self.roles.keys() {
                    if !(1..=255).contains(&role.len()) {
                        return Err(RoleConfigParsingError::InvalidRoleIdentifier(role.clone()));
                    }
                }
                Ok(())
            }
        }

        let raw: Config = toml_edit::de::from_str(source)?;
        raw.validate()?;

        let Config { roles } = raw;
        let mut config = Self {
            superuser: false,
            resolved_roles: Default::default(),
        };

        fn resolve_role<B: BuiltinRoleSet>(
            role: &str,
            roles: &HashMap<String, ApplicationRole>,
            resolved_roles: &HashMap<RoleIdentifier, HashSet<B>>,
        ) -> Result<HashSet<B>, RoleConfigParsingError> {
            // 1. Is the role already resolved?
            if let Some(role) = resolved_roles.get(role) {
                return Ok(role.clone());
            }

            // 2. Is it a built-in role?
            if let Ok(builtin_role) = B::from_str(role) {
                // If so it maps to itself.
                return Ok(std::iter::once(builtin_role).collect());
            }

            // 3. Then it has to be an application role.
            let ApplicationRole { implies } = roles.get(role).ok_or_else(|| {
                RoleConfigParsingError::UndeclaredRoleIdentifier(role.to_string())
            })?;
            let mut resolved = HashSet::new();
            for implied_role in implies {
                // Recursively resolve implied roles and flatten the built-in roles set.
                let implied = resolve_role(implied_role, roles, resolved_roles)?;
                resolved.extend(implied);
            }
            Ok(resolved)
        }

        for role in roles.keys() {
            if B::from_str(role).is_ok() {
                return Err(RoleConfigParsingError::ReservedRoleIdentifier(role.clone()));
            }
            let resolved = resolve_role(role, &roles, &config.resolved_roles)?;

            // a role cannot be duplicated in the config (TOML hashmap)
            config.resolved_roles.insert(role.to_owned(), resolved);
        }
        Ok(config)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RoleConfigParsingError {
    #[error(transparent)]
    ParsingError(#[from] toml_edit::de::Error),
    #[error("Invalid role identifier: '{0}'")]
    InvalidRoleIdentifier(String),
    #[error("Role identifier '{0}' is neither a builtin role or a declared application role")]
    UndeclaredRoleIdentifier(RoleIdentifier),
    #[error("Role identifier '{0}' is a reserved builtin role")]
    ReservedRoleIdentifier(RoleIdentifier),
}

impl<B: BuiltinRoleSet> std::fmt::Display for RoleConfig<B> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.superuser {
            write!(f, "RoleConfig(superuser)")
        } else {
            write!(f, "RoleConfig({} roles))", self.resolved_roles.len())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn parsing_ok() {
        let source = r#"
            [roles.anyone]
            implies = ["doc_read"]

            [roles.doc_provider]
            implies = ["doc_delete", "doc_edit", "doc_read"]

            [roles.admin]
            implies = ["user_add", "user_ban"]

            [roles.dev]
            implies = ["admin", "doc_provider"]
        "#;
        let config =
            RoleConfig::<TestBuiltinRole>::load(source).expect("should parse successfully");
        assert_eq!(config.resolved_roles.len(), 4);

        impl RoleConfig<TestBuiltinRole> {
            fn assert_roles(&self, role: &str, builtin_roles: &[TestBuiltinRole]) {
                let builtin_roles: HashSet<_> = builtin_roles.iter().cloned().collect();
                assert_eq!(
                    self.resolved_roles.get(role).expect("role should exist"),
                    &builtin_roles
                );
            }
        }
        use TestBuiltinRole::*;
        config.assert_roles("anyone", &[DocRead]);
        config.assert_roles("doc_provider", &[DocDelete, DocEdit, DocRead]);
        config.assert_roles("admin", &[UserAdd, UserBan]);
        config.assert_roles("dev", &[UserAdd, UserBan, DocDelete, DocEdit, DocRead]);
    }

    #[test]
    fn reserved_role_identifier() {
        let source = r#"
            [roles.doc_read]
            implies = ["doc_read"]
        "#;
        let err = RoleConfig::<TestBuiltinRole>::load(source).unwrap_err();
        assert!(matches!(
            err,
            RoleConfigParsingError::ReservedRoleIdentifier(_)
        ));
    }

    #[test]
    fn undeclared_role_identifier() {
        let source = r#"
            [roles.foo]
            implies = ["undeclared"]
        "#;
        let err = RoleConfig::<TestBuiltinRole>::load(source).unwrap_err();
        assert!(matches!(
            err,
            RoleConfigParsingError::UndeclaredRoleIdentifier(_)
        ));
    }

    #[test]
    fn not_toml() {
        let source = "not toml";
        let err = RoleConfig::<TestBuiltinRole>::load(source).unwrap_err();
        assert!(matches!(err, RoleConfigParsingError::ParsingError(_)));
    }

    #[test]
    fn invalid_application_role_identifier() {
        let source = r#"
            roles = { "" = { implies = [] } }
        "#;
        let err = RoleConfig::<TestBuiltinRole>::load(source).unwrap_err();
        assert!(matches!(
            err,
            RoleConfigParsingError::InvalidRoleIdentifier(_)
        ));

        let source = format!(
            r#"
            roles = {{ "{} batman!" = {{ implies = [] }} }}
            "#,
            "na".repeat(256)
        );
        let err = RoleConfig::<TestBuiltinRole>::load(&source).unwrap_err();
        assert!(matches!(
            err,
            RoleConfigParsingError::InvalidRoleIdentifier(_)
        ));
    }
}
