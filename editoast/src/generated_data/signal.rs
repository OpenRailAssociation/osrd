use async_trait::async_trait;
use diesel::delete;
use diesel::query_dsl::methods::FilterDsl;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt, Nullable, Text};
use diesel_async::AsyncPgConnection as PgConnection;
use std::collections::HashMap;

use super::utils::InvolvedObjects;
use super::GeneratedData;
use crate::diesel::ExpressionMethods;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::schema::sprite_config::{SpriteConfig, SpriteConfigs};
use crate::schema::{LogicalSignal, ObjectType};
use crate::tables::infra_layer_signal::dsl as layer_dsl;
use crate::tables::search_signal::dsl as search_dsl;

pub struct SignalLayer;

/// Finds the corresponding sprite id for a given logical signal
fn find_sprite_id(sprite_config: &SpriteConfigs, logical_signal: &LogicalSignal) -> Option<String> {
    let sprite_config = sprite_config.get(&logical_signal.signaling_system)?;
    'sprite: for conditional_sprite in &sprite_config.sprites {
        for (cond_key, cond_value) in &conditional_sprite.conditions {
            match logical_signal.settings.get(&cond_key.clone().into()) {
                Some(value) if &value.0 == cond_value => continue,
                _ => continue 'sprite,
            }
        }
        // All conditions are met
        return Some(conditional_sprite.sprite.clone());
    }
    Some(sprite_config.default.clone())
}

/// Generate the signaling system and sprite fields of the layer.
/// Only updated_signals are updated
async fn generate_signaling_system_and_sprite<'a, T: Iterator<Item = &'a String>>(
    conn: &mut PgConnection,
    infra: i64,
    infra_cache: &InfraCache,
    updated_signals: T,
) -> Result<()> {
    let sprite_configs = SpriteConfig::load();
    let mut group_by_sprite: HashMap<_, Vec<_>> = HashMap::new();

    for signal_id in updated_signals {
        let signal = infra_cache
            .signals()
            .get(signal_id)
            .expect("Cache out of sync");
        let logical_signal = match signal.unwrap_signal().logical_signals.first() {
            Some(logical_signal) => logical_signal,
            None => continue,
        };

        let signaling_system = &logical_signal.signaling_system;
        let sprite_id = find_sprite_id(&sprite_configs, logical_signal);

        group_by_sprite
            .entry((signaling_system, sprite_id))
            .or_default()
            .push(signal_id);
    }

    for ((signaling_system, sprite_id), signals) in group_by_sprite {
        use diesel_async::RunQueryDsl;
        sql_query("UPDATE infra_layer_signal SET signaling_system = $2, sprite = $3 WHERE infra_id = $1 AND obj_id = ANY($4)")
            .bind::<BigInt, _>(infra)
            .bind::<Text, _>(signaling_system)
            .bind::<Nullable<Text>, _>(sprite_id)
            .bind::<Array<Text>, _>(signals)
            .execute(conn)
            .await?;
    }
    Ok(())
}

#[async_trait]
impl GeneratedData for SignalLayer {
    fn table_name() -> &'static str {
        "infra_layer_signal"
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
        sql_query("DELETE FROM search_signal WHERE infra_id = $1")
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        Ok(())
    }

    async fn generate(conn: &mut PgConnection, infra: i64, infra_cache: &InfraCache) -> Result<()> {
        use diesel_async::RunQueryDsl;

        sql_query(include_str!("sql/generate_signal_layer.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        sql_query(include_str!("sql/generate_search_signal.sql"))
            .bind::<BigInt, _>(infra)
            .execute(conn)
            .await?;
        generate_signaling_system_and_sprite(
            conn,
            infra,
            infra_cache,
            infra_cache.signals().keys(), // All signals
        )
        .await?;
        Ok(())
    }

    async fn update(
        conn: &mut PgConnection,
        infra: i64,
        operations: &[crate::schema::operation::CacheOperation],
        infra_cache: &crate::infra_cache::InfraCache,
    ) -> Result<()> {
        use diesel_async::RunQueryDsl;

        let involved_objects =
            InvolvedObjects::from_operations(operations, infra_cache, ObjectType::Signal);

        // Delete elements
        if !involved_objects.deleted.is_empty() {
            delete(
                layer_dsl::infra_layer_signal
                    .filter(layer_dsl::infra_id.eq(infra))
                    .filter(layer_dsl::obj_id.eq_any(involved_objects.clone().deleted)),
            )
            .execute(conn)
            .await?;
            delete(
                search_dsl::search_signal
                    .filter(search_dsl::infra_id.eq(Some(infra as i32)))
                    .filter(search_dsl::obj_id.eq_any(involved_objects.deleted)),
            )
            .execute(conn)
            .await?;
        }

        // Update elements
        if !involved_objects.updated.is_empty() {
            let updated_signals = involved_objects.updated.into_iter().collect::<Vec<_>>();
            sql_query(include_str!("sql/insert_update_signal_layer.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(&updated_signals)
                .execute(conn)
                .await?;
            sql_query(include_str!("sql/insert_update_search_signal.sql"))
                .bind::<BigInt, _>(infra)
                .bind::<Array<Text>, _>(&updated_signals)
                .execute(conn)
                .await?;
            generate_signaling_system_and_sprite(
                conn,
                infra,
                infra_cache,
                updated_signals.into_iter(),
            )
            .await?;
        }
        Ok(())
    }
}
