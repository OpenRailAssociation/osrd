mod utils;

mod buffer_stop;
mod detector;
mod electrification;
mod error;
mod level_crossing;
mod neutral_section;
mod neutral_sign;
pub mod operational_point;
mod psl_sign;
mod signal;
pub mod speed_limit_tags_config;
mod speed_section;
pub mod sprite_config;
mod switch;
mod track_section;

use buffer_stop::BufferStopLayer;
use detector::DetectorLayer;
use diesel::pg::Pg;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;
use editoast_models::pagination::load_for_pagination;
use electrification::ElectrificationLayer;
use error::ErrorLayer;
pub use error::generate_infra_errors;
pub use error::infra_error;
use level_crossing::LevelCrossingLayer;
use neutral_section::NeutralSectionLayer;
use neutral_sign::NeutralSignLayer;
use operational_point::OperationalPointLayer;
use psl_sign::PSLSignLayer;
use schemas::primitives::Identifier;
use serde::Deserialize;
use signal::SignalLayer;
use speed_section::SpeedSectionLayer;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;
use switch::SwitchLayer;
use tracing::debug;
use track_section::TrackSectionLayer;

use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorTypeLabel;
use crate::infra_cache::InfraCache;
use crate::infra_cache::operation::CacheOperation;
use crate::models::Infra;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_models::prelude::*;

/// This trait define how a generated data table should be handled
pub trait GeneratedData {
    fn table_name() -> &'static str;
    async fn generate(
        conn: &mut DbConnection,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<(), database::DatabaseError>;

    async fn clear(conn: &mut DbConnection, infra: i64) -> Result<(), database::DatabaseError> {
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<BigInt, _>(infra)
        .execute(conn.write().await.deref_mut())
        .await?;
        Ok(())
    }

    async fn refresh(
        conn: &mut DbConnection,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<(), database::DatabaseError> {
        Self::clear(conn, infra).await?;
        Self::generate(conn, infra, infra_cache).await
    }

    async fn refresh_pool(
        pool: Arc<DbConnectionPoolV2>,
        infra: i64,
        infra_cache: &InfraCache,
    ) -> Result<(), database::DatabasePoolError> {
        Ok(Self::refresh(&mut pool.get().await?, infra, infra_cache).await?)
    }

    /// Search and update all objects that needs to be refreshed given a list of operation.
    async fn update(
        conn: &mut DbConnection,
        infra: i64,
        operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<(), database::DatabaseError>;
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum InfraErrorLevel {
    Warnings,
    Errors,
    #[default]
    All,
}

pub trait InfraGeneratedData {
    async fn refresh(
        &mut self,
        db_pool: Arc<DbConnectionPoolV2>,
        force: bool,
        infra_cache: &InfraCache,
    ) -> Result<bool, database::DatabasePoolError>;

    async fn clear(&mut self, conn: &mut DbConnection) -> Result<bool, editoast_models::Error>;

    async fn get_paginated_errors(
        &self,
        conn: &mut DbConnection,
        level: InfraErrorLevel,
        error_type: Option<InfraErrorTypeLabel>,
        object_id: Option<Identifier>,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<InfraError>, u64), editoast_models::Error>;

    async fn get_error_summary(
        &self,
        conn: &mut DbConnection,
    ) -> Result<HashMap<(String, String), u64>, editoast_models::Error>;
}

impl InfraGeneratedData for Infra {
    /// Refreshes generated data if not up to date and returns whether they were refreshed.
    /// `force` argument allows us to refresh it in any cases.
    /// This function will update `generated_version` accordingly.
    /// If refreshed you need to call `invalidate_after_refresh` to invalidate layer cache
    async fn refresh(
        &mut self,
        db_pool: Arc<DbConnectionPoolV2>,
        force: bool,
        infra_cache: &InfraCache,
    ) -> Result<bool, database::DatabasePoolError> {
        // Check if refresh is needed
        if !force && Some(self.version) == self.generated_version {
            return Ok(false);
        }

        // TODO: lock self for update

        refresh_all(db_pool.clone(), self.id, infra_cache).await?;

        // Update generated infra version
        self.bump_generated_version(&mut db_pool.get().await?)
            .await?;

        Ok(true)
    }

    /// Clear generated data of the infra
    /// This function will update `generated_version` accordingly.
    async fn clear(&mut self, conn: &mut DbConnection) -> Result<bool, editoast_models::Error> {
        // TODO: lock self for update
        clear_all(conn, self.id).await?;
        self.generated_version = None;
        self.save(conn).await?;
        Ok(true)
    }

    async fn get_paginated_errors(
        &self,
        conn: &mut DbConnection,
        level: InfraErrorLevel,
        error_type: Option<InfraErrorTypeLabel>,
        object_id: Option<Identifier>,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<InfraError>, u64), editoast_models::Error> {
        use database::tables::infra_layer_error::dsl;
        use database::tables::infra_layer_error::table;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::*;

        type Filter = Box<dyn BoxableExpression<table, Pg, SqlType = Bool>>;
        fn sql_true() -> Filter {
            Box::new(sql::<Bool>("TRUE"))
        }

        let level_filter: Filter = match level {
            InfraErrorLevel::Warnings => {
                Box::new(sql::<Text>("information->>'is_warning'").eq("true"))
            }
            InfraErrorLevel::Errors => {
                Box::new(sql::<Text>("information->>'is_warning'").eq("false"))
            }
            InfraErrorLevel::All => sql_true(),
        };
        let error_type_filter: Filter = error_type
            .as_ref()
            .map(|ty| ty.as_ref())
            .map(|ty| -> Filter {
                Box::new(sql::<Text>("information->>'error_type'").eq(ty.to_owned()))
            })
            .unwrap_or_else(sql_true);
        let object_id_filter: Filter = object_id
            .map(|id| id.0)
            .map(|id| -> Filter { Box::new(sql::<Text>("information->>'obj_id'").eq(id)) })
            .unwrap_or_else(sql_true);

        let query = dsl::infra_layer_error
            .select(dsl::information)
            .filter(dsl::infra_id.eq(self.id))
            .filter(level_filter)
            .filter(error_type_filter)
            .filter(object_id_filter);

        #[derive(QueryableByName)]
        struct Result {
            #[diesel(sql_type = Jsonb)]
            information: diesel_json::Json<InfraError>,
        }
        let (results, count): (Vec<Result>, _) =
            load_for_pagination(conn, query, page, page_size).await?;
        let results = results.into_iter().map(|r| r.information.0).collect();
        Ok((results, count))
    }

    /// Get the number of errors for each error type and object type.
    async fn get_error_summary(
        &self,
        conn: &mut DbConnection,
    ) -> Result<HashMap<(String, String), u64>, editoast_models::Error> {
        use database::tables::infra_layer_error::dsl;
        use diesel::dsl::count_star;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::Text;
        use diesel_async::RunQueryDsl;

        let query = dsl::infra_layer_error
            .select((
                sql::<Text>("information->>'error_type'"),
                sql::<Text>("information->>'obj_type'"),
                count_star(),
            ))
            .filter(dsl::infra_id.eq(self.id))
            .filter(sql::<Text>("information->>'is_warning'").eq("false"))
            .group_by((
                sql::<Text>("information->>'error_type'"),
                sql::<Text>("information->>'obj_type'"),
            ))
            .order_by(count_star().desc());

        let results = query
            .load::<(String, String, i64)>(conn.write().await.deref_mut())
            .await?;

        Ok(results
            .into_iter()
            .map(|(err_ty, obj_ty, count)| ((err_ty, obj_ty), count as u64))
            .collect())
    }
}

/// Refresh all the generated data of a given infra
#[tracing::instrument(level = "debug", skip_all, fields(infra_id))]
pub async fn refresh_all(
    db_pool: Arc<DbConnectionPoolV2>,
    infra_id: i64,
    infra_cache: &InfraCache,
) -> Result<(), database::DatabasePoolError> {
    // The other layers depend on track section layer.
    // We must wait until its completion before running the other requests in parallel
    TrackSectionLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache).await?;
    debug!("⚙️ Infra {infra_id}: track section layer is generated");
    // The analyze step significantly improves the performance when importing and generating together
    // It doesn’t seem to make a different when the generation step is ran separately
    // It isn’t clear why without analyze the Postgres server seems to run at 100% without halting
    sql_query("analyze")
        .execute(&mut db_pool.get().await?.write().await.deref_mut())
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
        LevelCrossingLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache),
    )?;
    debug!("⚙️ Infra {infra_id}: object layers is generated");
    // The error layer depends on the other layers and must be executed at the end.
    ErrorLayer::refresh_pool(db_pool.clone(), infra_id, infra_cache).await?;
    debug!("⚙️ Infra {infra_id}: errors layer is generated");
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn clear_all(conn: &mut DbConnection, infra: i64) -> Result<(), database::DatabaseError> {
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
    LevelCrossingLayer::clear(conn, infra).await?;
    Ok(())
}

/// Clear all the generated data of a given infra
pub async fn update_all(
    conn: &mut DbConnection,
    infra: i64,
    operations: &[CacheOperation],
    infra_cache: &InfraCache,
) -> Result<(), database::DatabaseError> {
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
    LevelCrossingLayer::update(conn, infra, operations, infra_cache).await?;
    Ok(())
}

#[cfg(test)]
pub mod tests {

    use crate::generated_data::clear_all;
    use crate::generated_data::refresh_all;
    use crate::generated_data::update_all;
    use crate::models::fixtures::create_empty_infra;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // Slow test
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn refresh_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(&mut db_pool.get_ok()).await;
        assert!(
            refresh_all(db_pool.into(), infra.id, &Default::default())
                .await
                .is_ok()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(&mut db_pool.get_ok()).await;
        assert!(
            update_all(&mut db_pool.get_ok(), infra.id, &[], &Default::default())
                .await
                .is_ok()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn clear_all_test() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(&mut db_pool.get_ok()).await;
        assert!(clear_all(&mut db_pool.get_ok(), infra.id).await.is_ok());
    }
}
