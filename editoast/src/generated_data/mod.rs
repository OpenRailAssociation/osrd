mod utils;

mod buffer_stop;
mod detector;
mod electrification;
mod error;
mod neutral_section;
mod neutral_sign;
mod operational_point;
mod psl_sign;
mod signal;
mod speed_section;
pub mod sprite_config;
mod switch;
mod track_section;

use async_trait::async_trait;
use buffer_stop::BufferStopLayer;
use detector::DetectorLayer;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;
use electrification::ElectrificationLayer;
pub use error::generate_infra_errors;
pub use error::infra_error;
use error::ErrorLayer;
use neutral_section::NeutralSectionLayer;
use neutral_sign::NeutralSignLayer;
use operational_point::OperationalPointLayer;
use psl_sign::PSLSignLayer;
use signal::SignalLayer;
use speed_section::SpeedSectionLayer;
use switch::SwitchLayer;
use tracing::debug;
use track_section::TrackSectionLayer;

use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPool;

/// This trait define how a generated data table should be handled
#[async_trait]
pub trait GeneratedData {
    fn table_name() -> &'static str;
    async fn generate(conn: &mut DbConnection, infra: i64, infra_cache: &InfraCache) -> Result<()>;

    async fn clear(conn: &mut DbConnection, infra: i64) -> Result<()> {
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<BigInt, _>(infra)
        .execute(conn)
        .await?;
        Ok(())
    }

    async fn refresh(conn: &mut DbConnection, infra: i64, infra_cache: &InfraCache) -> Result<()> {
        Self::clear(conn, infra).await?;
        Self::generate(conn, infra, infra_cache).await
    }

    async fn refresh_pool(
        pool: crate::Data<DbConnectionPool>,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<()> {
        let mut conn = pool.get().await?;
        Self::refresh(&mut conn, infra, infra_cache).await
    }

    /// Search and update all objects that needs to be refreshed given a list of operation.
    async fn update(
        conn: &mut DbConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()>;
}

/// Refresh all the generated data of a given infra
pub async fn refresh_all(
    db_pool: crate::Data<DbConnectionPool>,
    infra: i64,
    infra_cache: &InfraCache,
) -> Result<()> {
    // The other layers depend on track section layer.
    // We must wait until its completion before running the other requests in parallel
    TrackSectionLayer::refresh_pool(db_pool.clone(), infra, infra_cache).await?;
    debug!("⚙️ Infra {infra}: track section layer is generated");
    let mut conn = db_pool.get().await?;
    // The analyze step significantly improves the performance when importing and generating together
    // It doesn’t seem to make a different when the generation step is ran separately
    // It isn’t clear why without analyze the Postgres server seems to run at 100% without halting
    sql_query("analyze").execute(&mut conn).await?;
    debug!("⚙️ Infra {infra}: database analyzed");
    futures::try_join!(
        SpeedSectionLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        SignalLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        SwitchLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        BufferStopLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        ElectrificationLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        DetectorLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        OperationalPointLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        PSLSignLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        NeutralSectionLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
        NeutralSignLayer::refresh_pool(db_pool.clone(), infra, infra_cache),
    )?;
    debug!("⚙️ Infra {infra}: object layers is generated");
    // The error layer depends on the other layers and must be executed at the end.
    ErrorLayer::refresh_pool(db_pool.clone(), infra, infra_cache).await?;
    debug!("⚙️ Infra {infra}: errors layer is generated");
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn clear_all(conn: &mut DbConnection, infra: i64) -> Result<()> {
    TrackSectionLayer::clear(conn, infra).await?;
    SpeedSectionLayer::clear(conn, infra).await?;
    SignalLayer::clear(conn, infra).await?;
    SwitchLayer::clear(conn, infra).await?;
    BufferStopLayer::clear(conn, infra).await?;
    ElectrificationLayer::clear(conn, infra).await?;
    DetectorLayer::clear(conn, infra).await?;
    OperationalPointLayer::clear(conn, infra).await?;
    PSLSignLayer::clear(conn, infra).await?;
    ErrorLayer::clear(conn, infra).await?;
    NeutralSectionLayer::clear(conn, infra).await?;
    NeutralSignLayer::clear(conn, infra).await?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn update_all(
    conn: &mut DbConnection,
    infra: i64,
    operations: &[CacheOperation],
    infra_cache: &InfraCache,
) -> Result<()> {
    TrackSectionLayer::update(conn, infra, operations, infra_cache).await?;
    SpeedSectionLayer::update(conn, infra, operations, infra_cache).await?;
    SignalLayer::update(conn, infra, operations, infra_cache).await?;
    SwitchLayer::update(conn, infra, operations, infra_cache).await?;
    BufferStopLayer::update(conn, infra, operations, infra_cache).await?;
    ElectrificationLayer::update(conn, infra, operations, infra_cache).await?;
    DetectorLayer::update(conn, infra, operations, infra_cache).await?;
    OperationalPointLayer::update(conn, infra, operations, infra_cache).await?;
    PSLSignLayer::update(conn, infra, operations, infra_cache).await?;
    ErrorLayer::update(conn, infra, operations, infra_cache).await?;
    NeutralSectionLayer::update(conn, infra, operations, infra_cache).await?;
    NeutralSignLayer::update(conn, infra, operations, infra_cache).await?;
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    use crate::fixtures::tests::db_pool;
    use crate::generated_data::clear_all;
    use crate::generated_data::refresh_all;
    use crate::generated_data::update_all;
    use crate::modelsv2::infra::tests::test_infra_transaction;

    #[actix_test] // Slow test
    async fn refresh_all_test() {
        test_infra_transaction(|_conn, infra| {
            async move {
                assert!(refresh_all(db_pool(), infra.id, &Default::default())
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await
    }

    #[actix_test]
    async fn update_all_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                assert!(update_all(conn, infra.id, &[], &Default::default())
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await
    }

    #[actix_test]
    async fn clear_all_test() {
        test_infra_transaction(|conn, infra| {
            async move {
                let res = clear_all(conn, infra.id).await;
                assert!(res.is_ok());
            }
            .scope_boxed()
        })
        .await
    }
}
