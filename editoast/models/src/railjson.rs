use chrono::Utc;
use database::Db;
use schemas::infra::RAILJSON_VERSION;
use schemas::infra::RailJson;
use schemas::infra::major_version;
use sea_orm::ColumnTrait;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm::TransactionTrait;
use sea_orm::prelude::Expr;

use crate::infra;
use crate::infra_objects::buffer_stop;
use crate::infra_objects::detector;
use crate::infra_objects::electrification;
use crate::infra_objects::level_crossing;
use crate::infra_objects::neutral_section;
use crate::infra_objects::operational_point;
use crate::infra_objects::route;
use crate::infra_objects::signal;
use crate::infra_objects::speed_section;
use crate::infra_objects::switch;
use crate::infra_objects::switch_type;
use crate::infra_objects::track_section;

#[derive(Debug, derive_more::From, thiserror::Error, PartialEq)]
pub enum RailJsonError {
    #[error("Unsupported railjson version '{actual}'. Should be {expected}.")]
    UnsupportedVersion { actual: String, expected: String },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

/// Inserts the content of a RailJson object into the database
///
/// All objects are attached to a given infra.
///
pub async fn persist_railjson(
    db: Db,
    infra_id: i64,
    railjson: RailJson,
) -> Result<(), RailJsonError> {
    let RailJson {
        version,
        track_sections,
        buffer_stops,
        electrifications,
        detectors,
        operational_points,
        routes,
        signals,
        switches,
        speed_sections,
        extended_switch_types,
        neutral_sections,
        level_crossings,
    } = railjson;

    if major_version(&version) != major_version(RAILJSON_VERSION) {
        return Err(RailJsonError::UnsupportedVersion {
            actual: version,
            expected: RAILJSON_VERSION.to_string(),
        });
    }

    db.transaction::<_, (), crate::Error>(|txn| {
        Box::pin(async move {
            let rows = track_section::Model::from_infra_schemas(infra_id, track_sections);
            if !rows.is_empty() {
                track_section::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = buffer_stop::Model::from_infra_schemas(infra_id, buffer_stops);
            if !rows.is_empty() {
                buffer_stop::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = electrification::Model::from_infra_schemas(infra_id, electrifications);
            if !rows.is_empty() {
                electrification::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = detector::Model::from_infra_schemas(infra_id, detectors);
            if !rows.is_empty() {
                detector::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = operational_point::Model::from_infra_schemas(infra_id, operational_points);
            if !rows.is_empty() {
                operational_point::Entity::insert_many(rows)
                    .exec(txn)
                    .await?;
            }
            let rows = route::Model::from_infra_schemas(infra_id, routes);
            if !rows.is_empty() {
                route::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = signal::Model::from_infra_schemas(infra_id, signals);
            if !rows.is_empty() {
                signal::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = switch::Model::from_infra_schemas(infra_id, switches);
            if !rows.is_empty() {
                switch::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = speed_section::Model::from_infra_schemas(infra_id, speed_sections);
            if !rows.is_empty() {
                speed_section::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = switch_type::Model::from_infra_schemas(infra_id, extended_switch_types);
            if !rows.is_empty() {
                switch_type::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = neutral_section::Model::from_infra_schemas(infra_id, neutral_sections);
            if !rows.is_empty() {
                neutral_section::Entity::insert_many(rows).exec(txn).await?;
            }
            let rows = level_crossing::Model::from_infra_schemas(infra_id, level_crossings);
            if !rows.is_empty() {
                level_crossing::Entity::insert_many(rows).exec(txn).await?;
            }

            infra::Entity::update_many()
                .col_expr(infra::Column::Modified, Expr::value(Utc::now()))
                .filter(infra::Column::Id.eq(infra_id))
                .exec(txn)
                .await?;
            Ok(())
        })
    })
    .await
    .map_err(RailJsonError::from)
}
