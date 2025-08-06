pub type UserIdentity = String;
pub type UserName = String;
pub type GroupName = String;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserInfo {
    pub identity: UserIdentity,
    pub name: UserName,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct User {
    pub info: UserInfo,
    pub id: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GroupInfo {
    pub name: GroupName,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Group {
    pub info: GroupInfo,
    pub id: i64,
}

impl std::fmt::Display for UserInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.identity, self.name)
    }
}

impl std::fmt::Display for User {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} [{}]", self.info, self.id)
    }
}

impl std::fmt::Display for GroupInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)
    }
}

impl AsRef<UserInfo> for User {
    fn as_ref(&self) -> &UserInfo {
        &self.info
    }
}
