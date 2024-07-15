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
pub mod speed_limit_tags_config;
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
use std::ops::DerefMut;
use std::sync::Arc;
use switch::SwitchLayer;
use tracing::debug;
use track_section::TrackSectionLayer;

use crate::error::Result;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::InfraCache;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;

editoast_common::schemas! {
    error::schemas(),
}

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
        pool: Arc<DbConnectionPoolV2>,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<()> {
        Self::refresh(pool.get().await?.deref_mut(), infra, infra_cache).await
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
#[tracing::instrument(level = "debug", skip_all, fields(infra_id))]
pub async fn refresh_all(
    db_pool: Arc<DbConnectionPoolV2>,
    infra_id: i64,
    infra_cache: &InfraCache,
) -> Result<()> {
    // The other layers depend on track section layer.
    // We must wait until its completion before running the other requests in parallel
    TrackSectionLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache).await?;
    debug!("⚙️ Infra {infra_id}: track section layer is generated");
    // The analyze step significantly improves the performance when importing and generating together
    // It doesn’t seem to make a different when the generation step is ran separately
    // It isn’t clear why without analyze the Postgres server seems to run at 100% without halting
    sql_query("analyze")
        .execute(db_pool.get().await?.deref_mut())
        .await?;
    debug!("⚙️ Infra {infra_id}: database analyzed");
    futures::try_join!(
        SpeedSectionLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        SignalLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        SwitchLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        BufferStopLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        ElectrificationLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        DetectorLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        OperationalPointLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        PSLSignLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        NeutralSectionLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
        NeutralSignLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
    )?;
    debug!("⚙️ Infra {infra_id}: object layers is generated");
    // The error layer depends on the other layers and must be executed at the end.
    ErrorLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache).await?;
    debug!("⚙️ Infra {infra_id}: errors layer is generated");
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
    use rstest::rstest;
    use std::ops::DerefMut;

    use crate::generated_data::clear_all;
    use crate::generated_data::refresh_all;
    use crate::generated_data::update_all;
    use crate::modelsv2::fixtures::create_empty_infra;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    // Slow test
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    #[serial_test::serial]
    async fn refresh_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        assert!(refresh_all(db_pool.into(), infra.id, &Default::default())
            .await
            .is_ok());
    }

    #[rstest]
    async fn update_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        assert!(update_all(
            db_pool.get_ok().deref_mut(),
            infra.id,
            &[],
            &Default::default()
        )
        .await
        .is_ok());
    }

    #[rstest]
    async fn clear_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        assert!(clear_all(db_pool.get_ok().deref_mut(), infra.id)
            .await
            .is_ok());
    }
}
