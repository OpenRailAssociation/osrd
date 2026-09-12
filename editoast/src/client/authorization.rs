pub mod grants;
pub mod roles;

use std::fmt::Display;

use anyhow::anyhow;
use anyhow::bail;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use database::DbConnection;
use models::Group;
use models::prelude::*;
use tracing::info;

/// A resolved subject with its display information
#[derive(Debug)]
struct RichSubject {
    id: i64,
    info: SubjectInfo,
}

#[derive(Debug)]
enum SubjectInfo {
    User(UserInfo),
    Group(GroupInfo),
}

impl RichSubject {
    fn new_user(id: i64, info: UserInfo) -> Self {
        Self {
            id,
            info: SubjectInfo::User(info),
        }
    }

    fn new_group(id: i64, info: GroupInfo) -> Self {
        Self {
            id,
            info: SubjectInfo::Group(info),
        }
    }

    async fn fetch_from_authz(
        subject: authz::Subject,
        conn: DbConnection,
    ) -> anyhow::Result<Option<Self>> {
        match subject {
            authz::Subject::User(authz::User(id)) => {
                let Some(user) = models::User::retrieve(conn.clone(), id).await? else {
                    return Ok(None);
                };
                let identities = user.get_identities(conn).await?;
                Ok(Some(Self::new_user(
                    id,
                    UserInfo {
                        name: user.name,
                        identities,
                    },
                )))
            }
            authz::Subject::Group(authz::Group(id)) => Ok(Group::retrieve(conn, id)
                .await?
                .map(|group| Self::new_group(id, GroupInfo { name: group.name }))),
        }
    }

    fn to_authz(&self) -> authz::Subject {
        match &self.info {
            SubjectInfo::User(_) => authz::Subject::User(authz::User(self.id)),
            SubjectInfo::Group(_) => authz::Subject::Group(authz::Group(self.id)),
        }
    }
}

impl Display for RichSubject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Self { id, info } = self;
        match info {
            SubjectInfo::User(UserInfo { name, identities }) => {
                write!(f, "User#{id}[{}] ({name})", identities.join(", "))
            }
            SubjectInfo::Group(info) => write!(f, "Group#{id} ({})", info.name),
        }
    }
}

/// Parse a subject identifier (numeric ID or user identity) and fetch its info
async fn parse_and_fetch_subject(subject: &str, conn: DbConnection) -> anyhow::Result<RichSubject> {
    let id = if let Ok(id) = subject.parse::<i64>() {
        id
    } else {
        models::User::retrieve_by_identity(&subject.to_owned(), conn.clone())
            .await?
            .ok_or_else(|| anyhow!("No user with identity '{subject}' found"))?
            .id
    };
    let subject = if let Some(user) = models::User::retrieve(conn.clone(), id).await? {
        let identities = user.get_identities(conn).await?;
        RichSubject::new_user(
            id,
            UserInfo {
                name: user.name,
                identities,
            },
        )
    } else if let Some(group) = Group::retrieve(conn, id).await? {
        RichSubject::new_group(id, GroupInfo { name: group.name })
    } else {
        bail!("No subject found with ID {id}");
    };
    info!("{subject}");
    Ok(subject)
}
