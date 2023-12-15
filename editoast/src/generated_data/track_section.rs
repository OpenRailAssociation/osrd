use crate::error::Result;
use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt, Text};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::infra_cache::InfraCache;
use crate::schema::ObjectType;
use crate::tables::infra_layer_track_section::dsl as layer_dsl;
use crate::tables::search_track::dsl as search_dsl;

pub struct TrackSectionLayer;

#[async_trait]
impl GeneratedData for TrackSectionLayer {
    fn table_name() -> &'static str {
        "infra_layer_track_section"
    }

    async fn clear(conn: &mut PgConnection, infra: i64) -> Result<()> {
        use diesel_async::RunQueryDsl;
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::table_name()
        ))
        .bind::<BigInt, _>(infra)
        .execute(conn)
        .await?;
        sql_query("DELETE FROM search_track WHERE infra_id = $1")
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn generate(conn: &mut PgConnection, infra: i64, _cache: &InfraCache) -> Result<()> {
        sql_query(include_str!("sql/generate_track_section_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        sql_query(include_str!("sql/generate_search_track.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[crate::schema::operation::CacheOperation],
        infra_cache: &crate::infra_cache::InfraCache,
    ) -> Result<()> {
        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::TrackSection);

        // Delete elements
        if !involved_objects.deleted.is_empty() {
            delete(
                layer_dsl::infra_layer_track_section
                    .filter(layer_dsl::infra_id.eq(infra))
                    .filter(layer_dsl::obj_id.eq_any(involved_objects.clone().deleted)),
            )
            .execute(conn)
            .await?;

            delete(
                search_dsl::search_track
                    .filter(search_dsl::infra_id.eq(infra as i32))
                    .filter(search_dsl::obj_id.eq_any(involved_objects.deleted)),
            )
            .execute(conn)
            .await?;
        }

        // Update elements
        if !involved_objects.updated.is_empty() {
            sql_query(include_str!("sql/insert_update_track_section_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
            sql_query(include_str!("sql/insert_update_search_track.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(involved_objects.updated.into_iter().collect::<Vec<_>>())
                .execute(conn)
                .await?;
        }
        Ok(())
    }
}
