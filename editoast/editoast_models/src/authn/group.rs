use crate::prelude::*;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Hash, Clone, Model, ToSchema, Serialize, Deserialize, PartialEq, Eq)]
#[model(table = database::tables::authn_group)]
#[model(gen(ops = crd, list, batch_ops = r))]
pub struct Group {
    pub id: i64,
    #[model(identifier)]
    pub name: String,
}

impl Group {
    #[tracing::instrument(skip_all, fields(%name), ret(level = "debug"), err)]
    pub async fn upsert(conn: database::DbConnection, name: String) -> Result<Self, crate::Error> {
        conn.transaction(async move |mut conn| {
            if let Some(group) = Self::retrieve(conn.clone(), name.clone()).await? {
                Ok(group)
            } else {
                let group = Self::changeset().name(name).create(&mut conn).await?;
                tracing::debug!(?group, "group created");
                Ok(group)
            }
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn group_upsert() {
        let pool = database::DbConnectionPoolV2::for_tests();

        let created = Group::upsert(pool.get_ok(), "tom and jerry".to_string())
            .await
            .expect("failed to insert group");
        assert_eq!(created.name, "tom and jerry");

        let updated = Group::upsert(pool.get_ok(), "tom and jerry".to_string())
            .await
            .expect("failed to upsert existing group");
        assert_eq!(updated, created);
    }
}
