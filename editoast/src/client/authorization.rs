pub mod grants;
pub mod roles;

use std::fmt::Display;

use anyhow::anyhow;
use anyhow::bail;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use tracing::info;

use editoast_models::PgAuthDriver;

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
        authz: &authz::Subject,
        driver: &PgAuthDriver,
    ) -> anyhow::Result<Option<Self>> {
        match authz {
            authz::Subject::User(authz::User(id)) => Ok(driver
                .get_user_info(*id)
                .await?
                .map(|info| Self::new_user(*id, info))),
            authz::Subject::Group(authz::Group(id)) => Ok(driver
                .get_group_info(*id)
                .await?
                .map(|info| Self::new_group(*id, info))),
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
async fn parse_and_fetch_subject(
    subject: &str,
    driver: &PgAuthDriver,
) -> anyhow::Result<RichSubject> {
    let id = if let Ok(id) = subject.parse::<i64>() {
        id
    } else {
        driver
            .get_user_id(&subject.to_owned())
            .await?
            .ok_or_else(|| anyhow!("No user with identity '{subject}' found"))?
    };
    let subject = if let Some(info) = driver.get_user_info(id).await? {
        RichSubject::new_user(id, info)
    } else if let Some(info) = driver.get_group_info(id).await? {
        RichSubject::new_group(id, info)
    } else {
        bail!("No subject found with ID {id}");
    };
    info!("{subject}");
    Ok(subject)
}
