use anyhow::Context as _;
use database::DbConnectionPool;
use futures::TryStreamExt as _;
use futures::future::try_join_all;
use itertools::Itertools as _;

use super::OpenfgaConfig;
use crate::views::OpenfgaConfig as ViewsOpenfgaConfig;

/// Clear resources named by DbConnectionPool::for_tests, TestAppBuilder, and fga::test_client!.
pub async fn clean_test_env(
    db_pool: &DbConnectionPool,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    tokio::try_join!(clean_databases(db_pool), clean_stores(openfga_config))?;
    Ok(())
}

async fn clean_databases(db_pool: &DbConnectionPool) -> anyhow::Result<()> {
    use diesel::sql_types::Text;
    use diesel_async::RunQueryDsl as _;

    #[derive(diesel::QueryableByName)]
    struct Database {
        #[diesel(sql_type = Text)]
        datname: String,
    }

    let databases = diesel::sql_query(
        "SELECT datname FROM pg_database
         WHERE NOT datistemplate AND datname <> current_database()
         ORDER BY datname",
    )
    .load::<Database>(&mut db_pool.get().await?.write().await)
    .await?
    .into_iter()
    .filter(|database| {
        database.datname.starts_with("test_") || database.datname.starts_with("osrd_template_")
    })
    .collect_vec();

    let deleted = databases.len();
    try_join_all(
        databases
            .into_iter()
            .map(|Database { datname }| async move {
                let conn = &mut db_pool.get().await?;
                // Database names are SQL identifiers and cannot be passed as bind parameters.
                let identifier = datname.replace('"', "\"\"");
                diesel::sql_query(format!(
                    "DROP DATABASE IF EXISTS \"{identifier}\" WITH (FORCE)"
                ))
                .execute(&mut conn.write().await)
                .await
                .with_context(|| format!("could not drop test database {datname}"))?;
                println!("Deleted database {datname}");
                Ok::<_, anyhow::Error>(())
            }),
    )
    .await?;
    println!("Deleted {deleted} test database(s), including cached templates");
    Ok(())
}

async fn clean_stores(openfga_config: OpenfgaConfig) -> anyhow::Result<()> {
    let config = ViewsOpenfgaConfig::from(openfga_config);
    let client = fga::Client::try_with_store(&config.store, config.as_settings()).await?;

    // Finish listing before deleting so pagination cannot skip stores as the list changes.
    let stores: Vec<_> = client
        .stores()
        .try_filter(|store| {
            // Prefixes from TestAppBuilder, test_client!, and the fga doctests.
            std::future::ready(
                store.id != client.store().id
                    && ["authz@", "migrations@", "fga-client-", "doctest_"]
                        .iter()
                        .any(|prefix| store.name.starts_with(prefix)),
            )
        })
        .try_collect()
        .await?;

    let deleted = stores.len();
    let client = &client;
    try_join_all(stores.into_iter().map(|store| async move {
        client.delete_store(&store.id).await.with_context(|| {
            format!(
                "could not delete OpenFGA store {} ({})",
                store.name, store.id
            )
        })?;
        println!("Deleted OpenFGA store {} ({})", store.name, store.id);
        Ok::<_, anyhow::Error>(())
    }))
    .await?;
    println!("Deleted {deleted} test OpenFGA store(s)");
    Ok(())
}
