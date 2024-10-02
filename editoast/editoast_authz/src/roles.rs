use std::str::FromStr;

pub trait BuiltinRoleSet:
    FromStr + AsRef<str> + Sized + Clone + std::hash::Hash + std::cmp::Eq + std::fmt::Debug
{
    /// Returns the builtin role that short-circuits all role and permission checks.
    fn superuser() -> Self;

    fn as_str(&self) -> &str {
        self.as_ref()
    }
}
