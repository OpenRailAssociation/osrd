mod bounding_box;

pub use bounding_box::{BoundingBox, InvalidationZone};
use reqwest::Client;
use serde_json::json;

use crate::client::ChartosConfig;
use crate::infra_cache::InfraCache;
use crate::schema::operation::{OperationResult, RailjsonObject};
use crate::schema::{OSRDObject, ObjectType};
use diesel::prelude::*;
use diesel::result::Error;
use diesel::sql_query;
use diesel::sql_types::{Array, Integer, Text};
use std::collections::HashSet;

#[async_trait]
pub trait Layer {
    fn get_table_name() -> &'static str;
    fn generate_layer_query() -> &'static str;
    fn insert_update_layer_query() -> &'static str;
    fn layer_name() -> &'static str;
    fn get_obj_type() -> ObjectType;

    /// Clear and regenerate fully the layer of a given infra id
    /// You need to invalidate chartos layer afterwards
    fn refresh(conn: &PgConnection, infra: i32) -> Result<(), Error> {
        // Clear layer
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::get_table_name()
        ))
        .bind::<Integer, _>(infra)
        .execute(conn)?;

        sql_query(Self::generate_layer_query())
            .bind::<Integer, _>(infra)
            .execute(conn)?;
        Ok(())
    }

    /// Insert or update some objects of the layer object
    fn update_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: HashSet<&String>,
    ) -> Result<(), Error> {
        Self::insert_list(conn, infra, obj_ids)
    }

    /// Insert some objects of the layer object
    fn insert_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: HashSet<&String>,
    ) -> Result<(), Error> {
        if obj_ids.is_empty() {
            return Ok(());
        }
        let obj_ids: Vec<&String> = obj_ids.into_iter().collect();

        sql_query(Self::insert_update_layer_query())
            .bind::<Integer, _>(infra)
            .bind::<Array<Text>, _>(&obj_ids)
            .execute(conn)?;
        Ok(())
    }

    /// Delete some object from the layer
    fn delete_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: HashSet<&String>,
    ) -> Result<(), Error> {
        if obj_ids.is_empty() {
            return Ok(());
        }

        let obj_ids: Vec<&String> = obj_ids.into_iter().collect();

        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1 AND obj_id = ANY($2)",
            Self::get_table_name()
        ))
        .bind::<Integer, _>(infra)
        .bind::<Array<Text>, _>(&obj_ids)
        .execute(conn)?;

        Ok(())
    }

    /// Invalidate a part of chartos layer cache.
    /// Panic if the request failed
    async fn invalidate_bbox_chartos_layer(
        infra_id: i32,
        zone: &InvalidationZone,
        chartos_config: &ChartosConfig,
    ) {
        let resp = Client::new()
            .post(format!(
                "{}layer/{}/invalidate_bbox/?infra={}",
                chartos_config.url(),
                Self::layer_name(),
                infra_id
            ))
            .json(&json!([
                {
                    "view": "geo",
                    "bbox": zone.geo,
                },
                {
                    "view": "sch",
                    "bbox": zone.sch,
                }
            ]))
            .bearer_auth(&chartos_config.chartos_token)
            .send()
            .await
            .expect("Failed to send invalidate request to chartos");
        if !resp.status().is_success() {
            panic!("Failed to invalidate chartos layer: {}", resp.status());
        }
    }

    /// Invalidate a whole chartos layer cache.
    /// Panic if the request failed
    async fn invalidate_chartos_layer(infra_id: i32, chartos_config: &ChartosConfig) {
        let resp = Client::new()
            .post(format!(
                "{}layer/{}/invalidate/?infra={}",
                chartos_config.url(),
                Self::layer_name(),
                infra_id
            ))
            .bearer_auth(&chartos_config.chartos_token)
            .send()
            .await
            .expect("Failed to send invalidate request to chartos");
        if !resp.status().is_success() {
            panic!("Failed to invalidate chartos layer: {}", resp.status());
        }
    }

    /// Search and update all objects that needs to be refreshed given a list of operation.
    /// You need to invalidate chartos layer afterwards
    fn update(
        conn: &PgConnection,
        infra: i32,
        operations: &Vec<OperationResult>,
        infra_cache: &InfraCache,
    ) -> Result<(), Error> {
        let mut update_obj_ids = HashSet::new();
        let mut delete_obj_ids = HashSet::new();
        for op in operations {
            match op {
                OperationResult::Create(RailjsonObject::TrackSection { railjson })
                | OperationResult::Update(RailjsonObject::TrackSection { railjson }) => {
                    fill_objects_track_refs(
                        infra_cache,
                        &railjson.id,
                        Self::get_obj_type(),
                        &mut update_obj_ids,
                    )
                }
                OperationResult::Create(railjson) | OperationResult::Update(railjson)
                    if railjson.get_type() == Self::get_obj_type() =>
                {
                    update_obj_ids.insert(railjson.get_id());
                }
                OperationResult::Delete(obj_ref) if obj_ref.obj_type == Self::get_obj_type() => {
                    delete_obj_ids.insert(&obj_ref.obj_id);
                }
                _ => (),
            }
        }

        if update_obj_ids.is_empty() && delete_obj_ids.is_empty() {
            // No update needed
            return Ok(());
        }

        Self::delete_list(conn, infra, delete_obj_ids)?;
        Self::update_list(conn, infra, update_obj_ids)?;

        Ok(())
    }

    fn clear(conn: &PgConnection, infra: i32) -> Result<(), Error> {
        // Clear layer
        sql_query(format!(
            "DELETE FROM {} WHERE infra_id = $1",
            Self::get_table_name()
        ))
        .bind::<Integer, _>(infra)
        .execute(conn)?;

        Ok(())
    }
}

/// Given an infra cache, fill results with all the objects ID of type `obj_type` that have a reference to the given `track_id`.
fn fill_objects_track_refs<'a>(
    infra_cache: &'a InfraCache,
    track_id: &String,
    obj_type: ObjectType,
    results: &mut HashSet<&'a String>,
) {
    infra_cache
        .get_track_refs_type(track_id, obj_type)
        .iter()
        .for_each(|obj_ref| {
            results.insert(&obj_ref.obj_id);
        });
}

#[cfg(test)]
pub mod tests {
    use crate::client::PostgresConfig;
    use crate::infra::Infra;
    use crate::layer::Layer;
    use crate::schema::{
        BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
        TrackSection, TrackSectionLink,
    };
    use diesel::{Connection, PgConnection};
    #[test]
    fn clear_test() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        let infra = Infra::create("test", &conn).unwrap();
        assert_eq!(TrackSection::clear(&conn, infra.id), Ok(()));
        assert_eq!(Switch::clear(&conn, infra.id), Ok(()));
        assert_eq!(Detector::clear(&conn, infra.id), Ok(()));
        assert_eq!(BufferStop::clear(&conn, infra.id), Ok(()));
        assert_eq!(Route::clear(&conn, infra.id), Ok(()));
        assert_eq!(OperationalPoint::clear(&conn, infra.id), Ok(()));
        assert_eq!(Catenary::clear(&conn, infra.id), Ok(()));
        assert_eq!(SpeedSection::clear(&conn, infra.id), Ok(()));
        assert_eq!(Signal::clear(&conn, infra.id), Ok(()));
        assert_eq!(TrackSectionLink::clear(&conn, infra.id), Ok(()));
    }
}
