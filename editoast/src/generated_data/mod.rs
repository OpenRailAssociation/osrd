mod utils;

mod buffer_stop;
mod catenary;
mod detector;
mod error;
mod neutral_section;
mod operational_point;
mod psl_sign;
mod signal;
mod speed_section;
mod switch;
mod track_section;
mod track_section_link;

use async_trait::async_trait;
use buffer_stop::BufferStopLayer;
use catenary::CatenaryLayer;
use detector::DetectorLayer;
use error::ErrorLayer;
use neutral_section::NeutralSectionLayer;
use operational_point::OperationalPointLayer;
use psl_sign::PSLSignLayer;
use signal::SignalLayer;
use speed_section::SpeedSectionLayer;
use switch::SwitchLayer;
use track_section::TrackSectionLayer;
use track_section_link::TrackSectionLinkLayer;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::schema::operation::OperationResult;
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

    /// Search and update all objects that needs to be refreshed given a list of operation.
    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[OperationResult],
        infra_cache: &InfraCache,
    ) -> Result<()>;
}

/// Refresh all the generated data of a given infra
pub async fn refresh_all(
    conn: &mut PgConnection,
    infra: i64,
    infra_cache: &InfraCache,
) -> Result<()> {
    TrackSectionLayer::refresh(conn, infra, infra_cache).await?;
    SpeedSectionLayer::refresh(conn, infra, infra_cache).await?;
    SignalLayer::refresh(conn, infra, infra_cache).await?;
    SwitchLayer::refresh(conn, infra, infra_cache).await?;
    BufferStopLayer::refresh(conn, infra, infra_cache).await?;
    CatenaryLayer::refresh(conn, infra, infra_cache).await?;
    DetectorLayer::refresh(conn, infra, infra_cache).await?;
    OperationalPointLayer::refresh(conn, infra, infra_cache).await?;
    TrackSectionLinkLayer::refresh(conn, infra, infra_cache).await?;
    PSLSignLayer::refresh(conn, infra, infra_cache).await?;
    ErrorLayer::refresh(conn, infra, infra_cache).await?;
    NeutralSectionLayer::refresh(conn, infra, infra_cache).await?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn clear_all(conn: &mut PgConnection, infra: i64) -> Result<()> {
    TrackSectionLayer::clear(conn, infra).await?;
    SpeedSectionLayer::clear(conn, infra).await?;
    SignalLayer::clear(conn, infra).await?;
    SwitchLayer::clear(conn, infra).await?;
    BufferStopLayer::clear(conn, infra).await?;
    CatenaryLayer::clear(conn, infra).await?;
    DetectorLayer::clear(conn, infra).await?;
    OperationalPointLayer::clear(conn, infra).await?;
    TrackSectionLinkLayer::clear(conn, infra).await?;
    PSLSignLayer::clear(conn, infra).await?;
    ErrorLayer::clear(conn, infra).await?;
    NeutralSectionLayer::clear(conn, infra).await?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn update_all(
    conn: &mut PgConnection,
    infra: i64,
    operations: &[OperationResult],
    infra_cache: &InfraCache,
) -> Result<()> {
    TrackSectionLayer::update(conn, infra, operations, infra_cache).await?;
    SpeedSectionLayer::update(conn, infra, operations, infra_cache).await?;
    SignalLayer::update(conn, infra, operations, infra_cache).await?;
    SwitchLayer::update(conn, infra, operations, infra_cache).await?;
    BufferStopLayer::update(conn, infra, operations, infra_cache).await?;
    CatenaryLayer::update(conn, infra, operations, infra_cache).await?;
    DetectorLayer::update(conn, infra, operations, infra_cache).await?;
    OperationalPointLayer::update(conn, infra, operations, infra_cache).await?;
    TrackSectionLinkLayer::update(conn, infra, operations, infra_cache).await?;
    PSLSignLayer::update(conn, infra, operations, infra_cache).await?;
    ErrorLayer::update(conn, infra, operations, infra_cache).await?;
    NeutralSectionLayer::update(conn, infra, operations, infra_cache).await?;
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use crate::generated_data::{clear_all, refresh_all, update_all};
    use crate::models::infra::tests::test_infra_transaction;
    use crate::models::Infra;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncPgConnection as PgConnection;

    #[actix_test]
    async fn refresh_all_test() {
        test_infra_transaction(|conn: &mut PgConnection, infra: Infra| {
            async move {
                assert!(refresh_all(conn, infra.id.unwrap(), &Default::default())
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
