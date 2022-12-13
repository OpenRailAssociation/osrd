mod utils;

mod buffer_stop;
mod catenary;
mod detector;
mod error;
mod lpv_panel;
mod operational_point;
mod signal;
mod speed_section;
mod switch;
mod track_section;
mod track_section_link;

use buffer_stop::BufferStopLayer;
use catenary::CatenaryLayer;
use detector::DetectorLayer;
use error::ErrorLayer;
use lpv_panel::LPVPanelLayer;
use operational_point::OperationalPointLayer;
use signal::SignalLayer;
use speed_section::SpeedSectionLayer;
use switch::SwitchLayer;
use track_section::TrackSectionLayer;
use track_section_link::TrackSectionLinkLayer;

use crate::api_error::ApiError;
use crate::infra_cache::InfraCache;
use crate::schema::operation::OperationResult;
use diesel::prelude::*;
use diesel::result::Error;
use diesel::sql_query;
use diesel::sql_types::Integer;

/// This trait define how a generated data table should be handled
pub trait GeneratedData {
    fn table_name() -> &'static str;
    fn generate(conn: &PgConnection, infra: i32, infra_cache: &InfraCache) -> Result<(), Error>;

    fn clear(conn: &PgConnection, infra: i32) -> Result<(), Error> {
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<Integer, _>(infra)
        .execute(conn)?;
        Ok(())
    }

    fn refresh(conn: &PgConnection, infra: i32, infra_cache: &InfraCache) -> Result<(), Error> {
        Self::clear(conn, infra)?;
        Self::generate(conn, infra, infra_cache)
    }

    /// Search and update all objects that needs to be refreshed given a list of operation.
    fn update(
        conn: &PgConnection,
        infra: i32,
        operations: &[OperationResult],
        infra_cache: &InfraCache,
    ) -> Result<(), Error>;
}

/// Refresh all the generated data of a given infra
pub fn refresh_all(
    conn: &PgConnection,
    infra: i32,
    infra_cache: &InfraCache,
) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::refresh(conn, infra, infra_cache)?;
    SpeedSectionLayer::refresh(conn, infra, infra_cache)?;
    SignalLayer::refresh(conn, infra, infra_cache)?;
    SwitchLayer::refresh(conn, infra, infra_cache)?;
    BufferStopLayer::refresh(conn, infra, infra_cache)?;
    CatenaryLayer::refresh(conn, infra, infra_cache)?;
    DetectorLayer::refresh(conn, infra, infra_cache)?;
    OperationalPointLayer::refresh(conn, infra, infra_cache)?;
    TrackSectionLinkLayer::refresh(conn, infra, infra_cache)?;
    LPVPanelLayer::refresh(conn, infra, infra_cache)?;
    ErrorLayer::refresh(conn, infra, infra_cache)?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub fn clear_all(conn: &PgConnection, infra: i32) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::clear(conn, infra)?;
    SpeedSectionLayer::clear(conn, infra)?;
    SignalLayer::clear(conn, infra)?;
    SwitchLayer::clear(conn, infra)?;
    BufferStopLayer::clear(conn, infra)?;
    CatenaryLayer::clear(conn, infra)?;
    DetectorLayer::clear(conn, infra)?;
    OperationalPointLayer::clear(conn, infra)?;
    TrackSectionLinkLayer::clear(conn, infra)?;
    LPVPanelLayer::clear(conn, infra)?;
    ErrorLayer::clear(conn, infra)?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub fn update_all(
    conn: &PgConnection,
    infra: i32,
    operations: &[OperationResult],
    infra_cache: &InfraCache,
) -> Result<(), Box<dyn ApiError>> {
    TrackSectionLayer::update(conn, infra, operations, infra_cache)?;
    SpeedSectionLayer::update(conn, infra, operations, infra_cache)?;
    SignalLayer::update(conn, infra, operations, infra_cache)?;
    SwitchLayer::update(conn, infra, operations, infra_cache)?;
    BufferStopLayer::update(conn, infra, operations, infra_cache)?;
    CatenaryLayer::update(conn, infra, operations, infra_cache)?;
    DetectorLayer::update(conn, infra, operations, infra_cache)?;
    OperationalPointLayer::update(conn, infra, operations, infra_cache)?;
    TrackSectionLinkLayer::update(conn, infra, operations, infra_cache)?;
    LPVPanelLayer::update(conn, infra, operations, infra_cache)?;
    ErrorLayer::update(conn, infra, operations, infra_cache)?;
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use crate::generated_data::{clear_all, refresh_all, update_all};
    use crate::infra::tests::test_infra_transaction;
    use crate::infra::Infra;
    use diesel::PgConnection;

    #[test]
    fn refresh_all_test() {
        test_infra_transaction(|conn: &PgConnection, infra: Infra| {
            assert!(refresh_all(conn, infra.id, &Default::default()).is_ok());
        })
    }

    #[test]
    fn update_all_test() {
        test_infra_transaction(|conn: &PgConnection, infra: Infra| {
            assert!(update_all(conn, infra.id, &[], &Default::default()).is_ok());
        })
    }

    #[test]
    fn clear_all_test() {
        test_infra_transaction(|conn: &PgConnection, infra: Infra| {
            assert!(clear_all(conn, infra.id).is_ok());
        })
    }
}
