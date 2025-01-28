pub mod errors;
mod object_queryable;
mod railjson_data;
mod route_from_waypoint_result;
mod speed_limit_tags;
mod split_track_section_with_data;
mod voltage;

use std::ops::DerefMut;

use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use diesel::delete;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use strum::IntoEnumIterator;
use tracing::debug;
use tracing::error;
use uuid::Uuid;

pub use object_queryable::ObjectQueryable;

use crate::error::Result;
use crate::generated_data;
use crate::infra_cache::InfraCache;
use crate::models::get_geometry_layer_table;
use crate::models::get_table;
use crate::models::prelude::*;
use crate::models::railjson::persist_railjson;
use crate::models::Create;
use editoast_models::tables::infra::dsl;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::RAILJSON_VERSION;
use editoast_schemas::primitives::ObjectType;

editoast_common::schemas! {
    Infra,
    object_queryable::schemas(),
}

/// The default version of a newly created infrastructure
///
/// This value is set by the database. This constant is used
/// in unit tests.
#[cfg(test)]
pub const DEFAULT_INFRA_VERSION: &str = "0";

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, Model, utoipa::ToSchema)]
#[model(table = editoast_models::tables::infra)]
#[model(gen(ops = crud, batch_ops = r, list))]
#[derivative(Default)]
pub struct Infra {
    pub id: i64,
    pub name: String,
    pub railjson_version: String,
    #[serde(skip)]
    pub owner: Uuid,
    pub version: String,
    #[schema(required)]
    pub generated_version: Option<String>,
    pub locked: bool,
    pub created: NaiveDateTime,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub modified: NaiveDateTime,
}

impl InfraChangeset {
    pub async fn persist(self, railjson: RailJson, conn: &mut DbConnection) -> Result<Infra> {
        let infra = self.create(conn).await?;
        // TODO: lock infra for update
        debug!("🛤  Begin importing all railjson objects");
        if let Err(e) = persist_railjson(conn, infra.id, railjson).await {
            error!("Could not import infrastructure {}. Rolling back", infra.id);
            infra.delete(conn).await?;
            return Err(e);
        };
        debug!("🛤  Import finished successfully");
        Ok(infra)
    }

    #[must_use = "builder methods are intended to be chained"]
    pub fn last_railjson_version(self) -> Self {
        self.railjson_version(RAILJSON_VERSION.to_owned())
    }
}

impl Infra {
    pub async fn all(conn: &mut DbConnection) -> Vec<Infra> {
        dsl::infra
            .load(conn.write().await.deref_mut())
            .await
            .expect("List infra query failed")
            .into_iter()
            .map(Self::from_row)
            .collect()
    }

    pub async fn bump_version(&mut self, conn: &mut DbConnection) -> Result<()> {
        let new_version = self
            .version
            .parse::<u32>()
            .expect("Cannot convert version into an Integer")
            + 1;
        self.version = new_version.to_string();
        self.save(conn).await
    }

    pub async fn bump_generated_version(&mut self, conn: &mut DbConnection) -> Result<()> {
        self.generated_version = Some(self.version.clone());
        self.save(conn).await
    }

    pub async fn clone(&self, conn: &mut DbConnection, new_name: String) -> Result<Infra> {
        conn.clone().transaction(|conn| Box::pin(async move {
            // Duplicate infra shell
            let cloned_infra = <Self as Clone>::clone(self)
                .into_changeset()
                .name(new_name)
                .created(Utc::now().naive_utc())
                .modified(Utc::now().naive_utc())
                .create(&mut conn.clone())
                .await?;

            // Disable triggers to speed up the cloning
            sql_query("ALTER TABLE infra_object_signal DISABLE TRIGGER search_signal__ins_trig").execute(conn.write().await.deref_mut()).await?;
            sql_query("ALTER TABLE infra_object_track_section DISABLE TRIGGER search_track__ins_trig").execute(conn.write().await.deref_mut()).await?;
            sql_query("ALTER TABLE infra_object_operational_point DISABLE TRIGGER search_operational_point__ins_trig").execute(conn.write().await.deref_mut()).await?;

            // Fill cloned infra with data
            for object in ObjectType::iter() {
                let model_table = get_table(&object);
                sql_query(format!(
                    "INSERT INTO {model_table}(obj_id,data,infra_id) SELECT obj_id,data,$1 FROM {model_table} WHERE infra_id = $2"
                ))
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(self.id)
                .execute(conn.write().await.deref_mut()).await?;

                if let Some(layer_table) = get_geometry_layer_table(&object) {
                    let layer_table = layer_table.to_string();
                    let sql = match object {
                        ObjectType::Signal => {
                            format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id, angle_geo, signaling_system, sprite)
                                    SELECT obj_id,geographic,$1,angle_geo, signaling_system, sprite FROM {layer_table} WHERE infra_id = $2")
                                }
                        ,
                        ObjectType::OperationalPoint => {
                            format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id, kp, track_section)
                                    SELECT obj_id,geographic,$1,kp, track_section FROM {layer_table} WHERE infra_id = $2")
                                }
                        _ => {
                            format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id) SELECT obj_id,geographic,$1 FROM {layer_table} WHERE infra_id=$2")
                        }
                    };

                    sql_query(sql)
                        .bind::<BigInt, _>(cloned_infra.id)
                        .bind::<BigInt, _>(self.id)
                        .execute(conn.write().await.deref_mut())
                        .await?;
                }
            }

            // Re-enable triggers to speed up the cloning
            sql_query("ALTER TABLE infra_object_signal ENABLE TRIGGER search_signal__ins_trig").execute(conn.write().await.deref_mut()).await?;
            sql_query("ALTER TABLE infra_object_track_section ENABLE TRIGGER search_track__ins_trig").execute(conn.write().await.deref_mut()).await?;
            sql_query("ALTER TABLE infra_object_operational_point ENABLE TRIGGER search_operational_point__ins_trig").execute(conn.write().await.deref_mut()).await?;

            // Fill search tables
            sql_query("INSERT INTO search_signal(id, label, line_name, infra_id, obj_id, signaling_systems, settings, line_code)
                        SELECT signal.id, label, line_name, $1, search_signal.obj_id, signaling_systems, settings, line_code FROM search_signal
                        JOIN infra_object_signal AS signal ON search_signal.obj_id = signal.obj_id and signal.infra_id = $1
                        WHERE search_signal.infra_id = $2")
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(self.id)
                .execute(conn.write().await.deref_mut()).await?;

            sql_query("INSERT INTO search_track(infra_id, line_code, line_name, unprocessed_line_name) SELECT $1, line_code, line_name, unprocessed_line_name FROM search_track WHERE infra_id = $2")
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(self.id)
                .execute(conn.write().await.deref_mut()).await?;

            sql_query("INSERT INTO search_operational_point(id, infra_id, obj_id, uic, trigram, ci, ch, name)
                        SELECT op.id, $1, op.obj_id, uic, trigram, ci, ch, name FROM search_operational_point
                        JOIN infra_object_operational_point AS op ON search_operational_point.obj_id = op.obj_id and op.infra_id = $1
                        WHERE search_operational_point.infra_id = $2")
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(self.id)
                .execute(conn.write().await.deref_mut()).await?;

            // Add error layers
            sql_query("INSERT INTO infra_layer_error(geographic, information, infra_id, info_hash) SELECT geographic, information, $1, info_hash FROM infra_layer_error WHERE infra_id = $2")
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(self.id)
                .execute(conn.write().await.deref_mut()).await?;

            // Add sign layers
            for layer_table in ["infra_layer_psl_sign", "infra_layer_neutral_sign"] {
                sql_query(format!("INSERT INTO {layer_table}(obj_id, geographic, data, infra_id, angle_geo) SELECT obj_id, geographic, data, $1, angle_geo FROM {layer_table} WHERE infra_id = $2"))
                    .bind::<BigInt, _>(cloned_infra.id)
                    .bind::<BigInt, _>(self.id)
                    .execute(conn.write().await.deref_mut()).await?;
            }

            Ok(cloned_infra)
        })).await
    }

    /// Refreshes generated data if not up to date and returns whether they were refreshed.
    /// `force` argument allows us to refresh it in any cases.
    /// This function will update `generated_version` accordingly.
    /// If refreshed you need to call `invalidate_after_refresh` to invalidate layer cache
    pub async fn refresh(
        &mut self,
        db_pool: Arc<DbConnectionPoolV2>,
        force: bool,
        infra_cache: &InfraCache,
    ) -> Result<bool> {
        // Check if refresh is needed
        if !force
            && self.generated_version.is_some()
            && &self.version == self.generated_version.as_ref().unwrap()
        {
            return Ok(false);
        }

        // TODO: lock self for update

        generated_data::refresh_all(db_pool.clone(), self.id, infra_cache).await?;

        // Update generated infra version
        self.bump_generated_version(&mut db_pool.get().await?)
            .await?;

        Ok(true)
    }

    /// Clear generated data of the infra
    /// This function will update `generated_version` accordingly.
    pub async fn clear(&mut self, conn: &mut DbConnection) -> Result<bool> {
        // TODO: lock self for update
        generated_data::clear_all(conn, self.id).await?;
        self.generated_version = None;
        self.save(conn).await?;
        Ok(true)
    }

    /// Delete efficiently all the data of the infra.
    /// This disable some triggers to speed up the deletion.
    ///
    /// Note: Everything is done in one transaction for consistency.
    pub async fn fast_delete_static(conn: DbConnection, infra_id: i64) -> Result<bool> {
        use editoast_models::tables::infra_object_track_section::dsl as track_section_dsl;
        use editoast_models::tables::search_track::dsl as search_track_dsl;

        conn.transaction(|conn| {
            Box::pin(async move {
                // Disable the trigger to speed up the deletion
                sql_query(
                    "ALTER TABLE infra_object_track_section DISABLE TRIGGER search_track__del_trig",
                )
                .execute(conn.write().await.deref_mut())
                .await?;
                // Delete the track sections
                delete(
                    track_section_dsl::infra_object_track_section
                        .filter(track_section_dsl::infra_id.eq(infra_id)),
                )
                .execute(conn.write().await.deref_mut())
                .await
                .expect("Failed to delete from infra_object_track_section");
                // Delete search track
                delete(
                    search_track_dsl::search_track
                        .filter(search_track_dsl::infra_id.eq(infra_id as i32)),
                )
                .execute(conn.write().await.deref_mut())
                .await
                .expect("Failed to delete from search_track");

                // Re-Enable the trigger to speed up the deletion
                sql_query(
                    "ALTER TABLE infra_object_track_section ENABLE TRIGGER search_track__del_trig",
                )
                .execute(conn.write().await.deref_mut())
                .await
                .expect("Failed to enable trigger");

                // Delete the rest of the infra
                Self::delete_static(&mut conn.clone(), infra_id).await
            })
        })
        .await
        .map_err(Into::into)
    }
}

#[cfg(test)]
pub mod tests {
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::NeutralSection;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::RailJson;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::infra::RAILJSON_VERSION;
    use editoast_schemas::primitives::OSRDIdentified;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use uuid::Uuid;

    use super::Infra;
    use crate::error::EditoastError;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::infra::DEFAULT_INFRA_VERSION;
    use crate::models::prelude::*;
    use crate::models::railjson::find_all_schemas;
    use crate::models::railjson::RailJsonError;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn create_infra() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(&mut db_pool.get_ok()).await;

        assert_eq!(infra.owner, Uuid::nil());
        assert_eq!(infra.railjson_version, RAILJSON_VERSION);
        assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
        assert_eq!(infra.generated_version, None);
        assert!(!infra.locked);
    }

    #[rstest]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    #[serial_test::serial]
    async fn clone_infra_with_new_name_returns_new_cloned_infra() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let infra_new_name = "clone_infra_with_new_name_returns_new_cloned_infra".to_string();

        // WHEN
        let result = empty_infra
            .clone(&mut db_pool.get_ok(), infra_new_name.clone())
            .await
            .expect("could not clone infra");

        // THEN
        assert_eq!(result.name, infra_new_name);
    }

    #[rstest]
    #[serial_test::serial]
    async fn persists_railjson_ko_version() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = Infra::changeset()
            .name("test".to_owned())
            .last_railjson_version()
            .persist(railjson_with_invalid_version, &mut db_pool.get_ok())
            .await;
        assert!(res.is_err());
        let expected_error = RailJsonError::UnsupportedVersion {
            actual: "0".to_string(),
            expected: RAILJSON_VERSION.to_string(),
        };
        assert_eq!(res.unwrap_err().get_type(), expected_error.get_type());
    }

    #[rstest]
    // The fixture leaks the persisted infra because we explicitly opened a
    // connection. This should be fixed by the testing utils rework. The ignore
    // should be removed after.
    #[ignore]
    async fn persist_railjson_ok() {
        // GIVEN
        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            extended_switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            neutral_sections: (0..10).map(|_| Default::default()).collect(),
            electrifications: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            version: RAILJSON_VERSION.to_string(),
        };

        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = Infra::changeset()
            .name("persist_railjson_ok_infra".to_owned())
            .last_railjson_version()
            .persist(railjson.clone(), &mut db_pool.get_ok())
            .await
            .expect("could not persist infra");

        // THEN
        assert_eq!(infra.railjson_version, railjson.version);

        fn sort<T: OSRDIdentified>(mut objects: Vec<T>) -> Vec<T> {
            objects.sort_by(|a, b| a.get_id().cmp(b.get_id()));
            objects
        }

        let id = infra.id;

        assert_eq!(
            sort::<BufferStop>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.buffer_stops)
        );
        assert_eq!(
            sort::<Route>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.routes)
        );
        assert_eq!(
            sort::<SwitchType>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.extended_switch_types)
        );
        assert_eq!(
            sort::<Switch>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.switches)
        );
        assert_eq!(
            sort::<TrackSection>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.track_sections)
        );
        assert_eq!(
            sort::<SpeedSection>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.speed_sections)
        );
        assert_eq!(
            sort::<NeutralSection>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.neutral_sections)
        );
        assert_eq!(
            sort::<Electrification>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.electrifications)
        );
        assert_eq!(
            sort::<Signal>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.signals)
        );
        assert_eq!(
            sort::<Detector>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.detectors)
        );
        assert_eq!(
            sort::<OperationalPoint>(find_all_schemas(&mut db_pool.get_ok(), id).await.unwrap()),
            sort(railjson.operational_points)
        );
    }
}
