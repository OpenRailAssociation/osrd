mod utils;

mod buffer_stop;
mod detector;
mod electrification;
mod error;
mod neutral_section;
mod operational_point;
mod psl_sign;
mod signal;
mod speed_section;
mod switch;
mod track_section;

pub use error::generate_infra_errors;

use async_trait::async_trait;
use buffer_stop::BufferStopLayer;
use detector::DetectorLayer;
use electrification::ElectrificationLayer;
use error::ErrorLayer;
use neutral_section::NeutralSectionLayer;
use operational_point::OperationalPointLayer;
use psl_sign::PSLSignLayer;
use signal::SignalLayer;
use speed_section::SpeedSectionLayer;
use switch::SwitchLayer;
use track_section::TrackSectionLayer;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::schema::operation::CacheOperation;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};

/// This trait define how a generated data table should be handled
#[async_trait]
pub trait GeneratedData {
    fn table_name() -> &'static str;
    async fn generate(conn: &mut PgConnection, infra: i64, infra_cache: &InfraCache) -> Result<()>;

    async fn clear(conn: &mut PgConnection, infra: i64) -> Result<()> {
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<BigInt, _>(infra)
        .execute(conn)
        .await?;
        Ok(())
    }

    async fn refresh(conn: &mut PgConnection, infra: i64, infra_cache: &InfraCache) -> Result<()> {
        Self::clear(conn, infra).await?;
        Self::generate(conn, infra, infra_cache).await
    }

    async fn refresh_pool(
        pool: crate::Data<crate::DbPool>,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<()> {
        let mut conn = pool.get().await?;
        Self::clear(&mut conn, infra).await?;
        Self::generate(&mut conn, infra, infra_cache).await
    }

    /// Search and update all objects that needs to be refreshed given a list of operation.
    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()>;
}

/// Refresh all the generated data of a given infra
pub async fn refresh_all(
    db_pool: crate::Data<crate::DbPool>,
    infra: i64,
    infra_cache: &InfraCache,
) -> Result<()> {
    // The other layers depend on track section layer.
    // We must wait until its completion before running the other requests in parallel
    TrackSectionLayer::refresh_pool(db_pool.clone(), infra, infra_cache).await?;
    log::debug!("⚙️ Infra {infra}: track section layer is generated");
    let mut conn = db_pool.get().await?;
    // The analyze step significantly improves the performance when importing and generating together
    // It doesn’t seem to make a different when the generation step is ran separately
    // It isn’t clear why without analyze the Postgres server seems to run at 100% without halting
    sql_query("analyze").execute(&mut conn).await?;
    log::debug!("⚙️ Infra {infra}: database analyzed");
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
    )?;
    log::debug!("⚙️ Infra {infra}: object layers is generated");
    // The error layer depends on the other layers and must be executed at the end.
    ErrorLayer::refresh_pool(db_pool.clone(), infra, infra_cache).await?;
    log::debug!("⚙️ Infra {infra}: errors layer is generated");
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn clear_all(conn: &mut PgConnection, infra: i64) -> Result<()> {
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
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn update_all(
    conn: &mut PgConnection,
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
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use crate::generated_data::{clear_all, refresh_all, update_all};
    use crate::models::infra::tests::{test_infra_and_delete, test_infra_transaction};
    use crate::models::Infra;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncPgConnection as PgConnection;

    #[actix_test] // Slow test
    async fn refresh_all_test() {
        test_infra_and_delete(|pool, infra: Infra| {
            async move {
                assert!(refresh_all(pool, infra.id.unwrap(), &Default::default())
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await
    }

    #[actix_test]
    async fn update_all_test() {
        test_infra_transaction(|conn: &mut PgConnection, infra: Infra| {
            async move {
                assert!(
                    update_all(conn, infra.id.unwrap(), &[], &Default::default())
                        .await
                        .is_ok()
                );
            }
            .scope_boxed()
        })
        .await
    }

    #[actix_test]
    async fn clear_all_test() {
        test_infra_transaction(|conn: &mut PgConnection, infra: Infra| {
            async move {
                assert!(clear_all(conn, infra.id.unwrap()).await.is_ok());
            }
            .scope_boxed()
        })
        .await
    }
}
