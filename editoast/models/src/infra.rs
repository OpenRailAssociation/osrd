mod object_queryable;
mod railjson_data;
mod route_from_waypoint_result;
mod speed_limit_tags;
mod split_track_section_with_data;
mod voltage;

use chrono::DateTime;
use chrono::Utc;
use database::Db;
use educe::Educe;
use schemas::infra::RAILJSON_VERSION;
use schemas::infra::RailJson;
use schemas::primitives::BoundingBox;
use schemas::primitives::ObjectType;
use sea_orm::ConnectionTrait;
use sea_orm::DatabaseBackend;
use sea_orm::Set;
use sea_orm::Statement;
use sea_orm::TransactionTrait;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use strum::IntoEnumIterator;
use tracing::debug;
use tracing::error;
use uuid::Uuid;

use crate::infra_objects::get_geometry_layer_table;
use crate::infra_objects::get_table;
use crate::railjson::RailJsonError;
use crate::railjson::persist_railjson;

pub use object_queryable::ObjectQueryable;

#[cfg(any(test, feature = "testing"))]
/// The default version of a newly created infrastructure
///
/// This value is set by the database. This constant is used
/// in unit tests.
pub const DEFAULT_INFRA_VERSION: i64 = 0;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, Educe, Serialize, utoipa::ToSchema)]
#[sea_orm(table_name = "infra")]
#[educe(Default)]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    pub railjson_version: String,
    #[serde(skip)]
    pub owner: Uuid,
    pub version: i64,
    #[schema(required)]
    pub generated_version: Option<i64>,
    pub locked: bool,
    pub created: DateTime<Utc>,
    #[educe(Default = Utc::now())]
    pub modified: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl ActiveModel {
    pub async fn persist(self, railjson: RailJson, db: Db) -> Result<Model, RailJsonError> {
        let infra = self.insert(&db).await?;
        // TODO: lock infra for update
        debug!("🛤  Begin importing all railjson objects");
        if let Err(e) = persist_railjson(db.clone(), infra.id, railjson).await {
            error!("Could not import infrastructure {}. Rolling back", infra.id);
            Entity::delete_by_id(infra.id).exec(&db).await?;
            return Err(e);
        };
        debug!("🛤  Import finished successfully");
        Ok(infra)
    }

    #[must_use = "builder methods are intended to be chained"]
    pub fn last_railjson_version(mut self) -> Self {
        self.railjson_version = Set(RAILJSON_VERSION.to_owned());
        self
    }
}

impl Model {
    pub async fn bump_version(&mut self, db: Db) -> Result<(), crate::Error> {
        self.version += 1;
        self.modified = Utc::now();
        ActiveModel {
            id: Set(self.id),
            version: Set(self.version),
            modified: Set(self.modified),
            ..Default::default()
        }
        .update(&db)
        .await?;
        Ok(())
    }

    pub async fn bump_generated_version(&mut self, db: Db) -> Result<(), crate::Error> {
        self.generated_version = Some(self.version);
        ActiveModel {
            id: Set(self.id),
            generated_version: Set(self.generated_version),
            ..Default::default()
        }
        .update(&db)
        .await?;
        Ok(())
    }

    pub async fn bbox(&self, db: Db) -> Result<Option<BoundingBox>, crate::Error> {
        // Retrieving min/max X/Y is required to handle flat infra along x or y axis. ST_Extent returns a LineString instead of Polygon in this case.
        let res = sqlx::query!("SELECT ST_XMin(env) as min_lon, ST_YMin(env) as min_lat, ST_XMax(env) as max_lon, ST_YMax(env) as max_lat FROM (SELECT ST_Transform(ST_SetSRID(ST_Extent(geographic), 3857), 4326) as env FROM infra_layer_track_section WHERE infra_id = $1) AS bbox_query", self.id)
        .fetch_one(db.sqlx())
        .await?;

        Ok(match (res.min_lon, res.min_lat, res.max_lon, res.max_lat) {
            (Some(min_lon), Some(min_lat), Some(max_lon), Some(max_lat)) => Some(BoundingBox {
                min_lon,
                min_lat,
                max_lon,
                max_lat,
            }),
            _ => None,
        })
    }

    pub async fn clone(&self, db: Db, new_name: String) -> Result<Model, crate::Error> {
        let mut active: ActiveModel = <Self as Clone>::clone(self).into();
        let infra_id = self.id;
        db.transaction::<_, Model, crate::Error>(move |txn| {
            Box::pin(async move {
                // Duplicate infra shell
                let now = Utc::now();
                active.id = Default::default();
                active.name = Set(new_name);
                active.created = Set(now);
                active.modified = Set(now);
                let cloned_infra = active.insert(txn).await?;

                // Disable triggers to speed up the cloning
                txn.execute_unprepared("ALTER TABLE infra_object_signal DISABLE TRIGGER search_signal__ins_trig").await?;
                txn.execute_unprepared("ALTER TABLE infra_object_track_section DISABLE TRIGGER search_track__ins_trig").await?;
                txn.execute_unprepared("ALTER TABLE infra_object_operational_point DISABLE TRIGGER search_operational_point__ins_trig").await?;

                // Fill cloned infra with data
                for object in ObjectType::iter() {
                    let model_table = get_table(&object);
                    txn.execute_raw(Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        format!(
                            "INSERT INTO {model_table}(obj_id,data,infra_id) SELECT obj_id,data,$1 FROM {model_table} WHERE infra_id = $2"
                        ),
                        [cloned_infra.id.into(), infra_id.into()],
                    ))
                    .await?;

                    if let Some(layer_table) = get_geometry_layer_table(&object) {
                        let layer_table = layer_table.to_string();
                        let sql = match object {
                            ObjectType::Signal => {
                                format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id, angle_geo, signaling_system, sprite)
                                    SELECT obj_id,geographic,$1,angle_geo, signaling_system, sprite FROM {layer_table} WHERE infra_id = $2")
                            }
                            ObjectType::OperationalPoint => {
                                format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id, kp, track_section, part_index)
                                    SELECT obj_id,geographic,$1,kp, track_section, part_index FROM {layer_table} WHERE infra_id = $2")
                            }
                            _ => {
                                format!("INSERT INTO {layer_table}(obj_id,geographic,infra_id) SELECT obj_id,geographic,$1 FROM {layer_table} WHERE infra_id=$2")
                            }
                        };
                        txn.execute_raw(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            sql,
                            [cloned_infra.id.into(), infra_id.into()],
                        ))
                        .await?;
                    }
                }

                // Re-enable triggers to speed up the cloning
                txn.execute_unprepared("ALTER TABLE infra_object_signal ENABLE TRIGGER search_signal__ins_trig").await?;
                txn.execute_unprepared("ALTER TABLE infra_object_track_section ENABLE TRIGGER search_track__ins_trig").await?;
                txn.execute_unprepared("ALTER TABLE infra_object_operational_point ENABLE TRIGGER search_operational_point__ins_trig").await?;

                // Fill search tables
                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO search_signal(id, label, line_name, infra_id, obj_id, signaling_systems, settings, line_code)
                        SELECT signal.id, label, line_name, $1, search_signal.obj_id, signaling_systems, settings, line_code FROM search_signal
                        JOIN infra_object_signal AS signal ON search_signal.obj_id = signal.obj_id and signal.infra_id = $1
                        WHERE search_signal.infra_id = $2",
                    [cloned_infra.id.into(), infra_id.into()],
                ))
                .await?;

                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO search_track(infra_id, line_code, line_name, unprocessed_line_name) SELECT $1, line_code, line_name, unprocessed_line_name FROM search_track WHERE infra_id = $2",
                    [cloned_infra.id.into(), infra_id.into()],
                ))
                .await?;

                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO search_operational_point(id, infra_id, obj_id, uic, main_code, secondary_code, name, is_passenger_station, secondary_name, country_code)
                        SELECT op.id, $1, op.obj_id, uic, main_code, secondary_code, name, is_passenger_station, secondary_name, country_code FROM search_operational_point
                        JOIN infra_object_operational_point AS op ON search_operational_point.obj_id = op.obj_id and op.infra_id = $1
                        WHERE search_operational_point.infra_id = $2",
                    [cloned_infra.id.into(), infra_id.into()],
                ))
                .await?;

                // Add error layers
                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO infra_layer_error(geographic, information, infra_id, info_hash) SELECT geographic, information, $1, info_hash FROM infra_layer_error WHERE infra_id = $2",
                    [cloned_infra.id.into(), infra_id.into()],
                ))
                .await?;

                // Add sign layers
                for layer_table in ["infra_layer_psl_sign", "infra_layer_neutral_sign"] {
                    txn.execute_raw(Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        format!("INSERT INTO {layer_table}(obj_id, geographic, data, infra_id, angle_geo) SELECT obj_id, geographic, data, $1, angle_geo FROM {layer_table} WHERE infra_id = $2"),
                        [cloned_infra.id.into(), infra_id.into()],
                    ))
                    .await?;
                }

                Ok(cloned_infra)
            })
        })
        .await
        .map_err(Into::into)
    }

    /// Delete efficiently all the data of the infra.
    /// This disable some triggers to speed up the deletion.
    ///
    /// Note: Everything is done in one transaction for consistency.
    pub async fn fast_delete_static(db: Db, infra_id: i64) -> Result<bool, crate::Error> {
        db.transaction::<_, bool, crate::Error>(|txn| {
            Box::pin(async move {
                // Disable the trigger to speed up the deletion
                txn.execute_unprepared(
                    "ALTER TABLE infra_object_track_section DISABLE TRIGGER search_track__del_trig",
                )
                .await?;
                // Delete the track sections
                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "DELETE FROM infra_object_track_section WHERE infra_id=$1",
                    [infra_id.into()],
                ))
                .await
                .expect("Failed to delete from infra_object_track_section");
                // Delete search track
                txn.execute_raw(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "DELETE FROM search_track WHERE infra_id=$1",
                    [infra_id.into()],
                ))
                .await
                .expect("Failed to delete from search_track");
                // Re-Enable the trigger to speed up the deletion
                txn.execute_unprepared(
                    "ALTER TABLE infra_object_track_section ENABLE TRIGGER search_track__del_trig",
                )
                .await
                .expect("Failed to enable trigger");
                // Delete the rest of the infra
                Ok(Entity::delete_by_id(infra_id)
                    .exec(txn)
                    .await?
                    .rows_affected
                    > 0)
            })
        })
        .await
        .map_err(Into::into)
    }
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;

    use database::Db;
    use schemas::infra::RAILJSON_VERSION;
    use schemas::infra::RailJson;
    use schemas::primitives::OSRDIdentified;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::ColumnTrait as _;
    use sea_orm::EntityTrait as _;
    use sea_orm::QueryFilter as _;
    use sea_orm::Set;
    use uuid::Uuid;

    use super::DEFAULT_INFRA_VERSION;
    use crate::infra;
    use crate::railjson::RailJsonError;

    async fn create_empty_infra(db: &Db) -> infra::Model {
        infra::ActiveModel {
            name: Set("empty_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .insert(db)
        .await
        .expect("Failed to create empty infra")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_infra() {
        let db = Db::for_tests().await;
        let infra = create_empty_infra(&db).await;

        assert_eq!(infra.owner, Uuid::nil());
        assert_eq!(infra.railjson_version, RAILJSON_VERSION);
        assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
        assert_eq!(infra.generated_version, None);
        assert!(!infra.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn clone_infra_with_new_name_returns_new_cloned_infra() {
        // GIVEN
        let db = Db::for_tests().await;
        let empty_infra = create_empty_infra(&db).await;
        let old_modification_date = empty_infra.modified;
        let infra_new_name = "clone_infra_with_new_name_returns_new_cloned_infra".to_string();

        // WHEN
        let result = empty_infra
            .clone(db.clone(), infra_new_name.clone())
            .await
            .expect("could not clone infra");

        // THEN
        assert_eq!(result.name, infra_new_name);
        assert!(old_modification_date < result.modified);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn persists_railjson_ko_version() {
        let db = Db::for_tests().await;
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = infra::ActiveModel {
            name: Set("test".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .persist(railjson_with_invalid_version, db.clone())
        .await;
        assert!(res.is_err());
        let expected_error = RailJsonError::UnsupportedVersion {
            actual: "0".to_string(),
            expected: RAILJSON_VERSION.to_string(),
        };
        assert_eq!(res.unwrap_err(), expected_error);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_change_updates_modification_date() {
        let db = Db::for_tests().await;
        let mut infra = create_empty_infra(&db).await;
        let old = infra.modified;

        std::thread::sleep(std::time::Duration::from_millis(1));

        infra
            .bump_version(db.clone())
            .await
            .expect("could not bump version");

        assert!(infra.modified > old);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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
            level_crossings: (0..10).map(|_| Default::default()).collect(),
            version: RAILJSON_VERSION.to_string(),
        };

        let db = Db::for_tests().await;
        let infra = infra::ActiveModel {
            name: Set("persist_railjson_ok_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .persist(railjson.clone(), db.clone())
        .await
        .expect("could not persist infra");

        // THEN
        assert_eq!(infra.railjson_version, railjson.version);

        fn sort<T: OSRDIdentified>(mut objects: Vec<T>) -> Vec<T> {
            objects.sort_by(|a, b| a.get_id().cmp(b.get_id()));
            objects
        }

        macro_rules! assert_schemas {
            ($module:ident, $schema:ty, $expected:expr) => {{
                let actual = crate::infra_objects::$module::Entity::find()
                    .filter(crate::infra_objects::$module::Column::InfraId.eq(infra.id))
                    .all(&db)
                    .await
                    .unwrap()
                    .into_iter()
                    .map(<$schema>::from)
                    .collect();
                assert_eq!(sort::<$schema>(actual), sort($expected));
            }};
        }

        assert_schemas!(
            buffer_stop,
            schemas::infra::BufferStop,
            railjson.buffer_stops
        );
        assert_schemas!(route, schemas::infra::Route, railjson.routes);
        assert_schemas!(
            switch_type,
            schemas::infra::SwitchType,
            railjson.extended_switch_types
        );
        assert_schemas!(switch, schemas::infra::Switch, railjson.switches);
        assert_schemas!(
            track_section,
            schemas::infra::TrackSection,
            railjson.track_sections
        );
        assert_schemas!(
            speed_section,
            schemas::infra::SpeedSection,
            railjson.speed_sections
        );
        assert_schemas!(
            neutral_section,
            schemas::infra::NeutralSection,
            railjson.neutral_sections
        );
        assert_schemas!(
            electrification,
            schemas::infra::Electrification,
            railjson.electrifications
        );
        assert_schemas!(signal, schemas::infra::Signal, railjson.signals);
        assert_schemas!(detector, schemas::infra::Detector, railjson.detectors);
        assert_schemas!(
            operational_point,
            schemas::infra::OperationalPoint,
            railjson.operational_points
        );
        assert_schemas!(
            level_crossing,
            schemas::infra::LevelCrossing,
            railjson.level_crossings
        );
    }
}
