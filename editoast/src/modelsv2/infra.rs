mod speed_limit_tags;
mod splited_track_section_with_data;
mod voltage;

use std::pin::Pin;

use async_trait::async_trait;
use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Double;
use diesel::sql_types::Text;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use futures::future::try_join_all;
use futures::Future;
use serde::Deserialize;
use serde::Serialize;
use speed_limit_tags::SpeedLimitTags;
use splited_track_section_with_data::SplitedTrackSectionWithData;
use std::sync::Arc;
use strum::IntoEnumIterator;
use tracing::debug;
use tracing::error;
use uuid::Uuid;
use voltage::Voltage;

use crate::error::Result;
use crate::generated_data;
use crate::infra_cache::InfraCache;
use crate::models::List;
use crate::models::NoParams;
use crate::modelsv2::get_geometry_layer_table;
use crate::modelsv2::get_table;
use crate::modelsv2::prelude::*;
use crate::modelsv2::railjson::persist_railjson;
use crate::modelsv2::Create;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPool;
use crate::tables::infra::dsl;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::RAILJSON_VERSION;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::primitives::ObjectType;

/// The default version of a newly created infrastructure
///
/// This value is set by the database. This constant is used
/// in unit tests.
#[cfg(test)]
pub const DEFAULT_INFRA_VERSION: &str = "0";

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, ModelV2)]
#[model(table = crate::tables::infra)]
#[derivative(Default)]
pub struct Infra {
    pub id: i64,
    pub name: String,
    pub railjson_version: String,
    #[serde(skip)]
    pub owner: Uuid,
    pub version: String,
    pub generated_version: Option<String>,
    pub locked: bool,
    pub created: NaiveDateTime,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub modified: NaiveDateTime,
}

impl InfraChangeset {
    pub async fn persist(
        self,
        railjson: RailJson,
        db_pool: Arc<DbConnectionPool>,
    ) -> Result<Infra> {
        let conn = &mut db_pool.get().await?;
        let infra = self.create(conn).await?;
        // TODO: lock infra for update
        debug!("🛤  Begin importing all railjson objects");
        if let Err(e) = persist_railjson(db_pool, infra.id, railjson).await {
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
            .load(conn)
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

    pub async fn clone(
        &self,
        db_pool: Arc<DbConnectionPool>,
        new_name: Option<String>,
    ) -> Result<Infra> {
        // Duplicate infra shell
        let new_name = new_name.unwrap_or_else(|| format!("{} (copy)", self.name));
        let mut conn = db_pool.get().await?;
        let cloned_infra = <Self as Clone>::clone(self)
            .into_changeset()
            .name(new_name)
            .created(Utc::now().naive_utc())
            .modified(Utc::now().naive_utc())
            .create(&mut conn)
            .await?;

        // TODO: lock clone infra for update

        // Fill cloned infra with data

        // When creating a connection for each objet, it will a panic with 'Cannot access shared transaction state' in the database pool
        // Just one connection fixes it, but partially* defeats the purpose of joining all the requests at the end
        // * AsyncPgConnection supports pipeling within one connection, but it won’t run parallel
        let mut futures = Vec::<Pin<Box<dyn Future<Output = _>>>>::new();
        let mut conn = db_pool.get().await?;
        for object in ObjectType::iter() {
            let model_table = get_table(&object);
            let model = sql_query(format!(
                "INSERT INTO {model_table}(obj_id,data,infra_id) SELECT obj_id,data,$1 FROM {model_table} WHERE infra_id = $2"
            ))
            .bind::<BigInt, _>(cloned_infra.id)
            .bind::<BigInt, _>(self.id)
            .execute(&mut conn);
            futures.push(model);

            if let Some(layer_table) = get_geometry_layer_table(&object) {
                let layer_table = layer_table.to_string();
                let sql = if layer_table != get_geometry_layer_table(&ObjectType::Signal).unwrap() {
                    format!(
                    "INSERT INTO {layer_table}(obj_id,geographic,schematic,infra_id) SELECT obj_id,geographic,schematic,$1 FROM {layer_table} WHERE infra_id=$2")
                } else {
                    // TODO: we should test this behavior
                    format!(
                    "INSERT INTO {layer_table}(obj_id,geographic,schematic,infra_id, angle_geo, angle_sch, signaling_system, sprite) SELECT obj_id,geographic,schematic,$1,angle_geo,angle_sch, signaling_system, sprite FROM {layer_table} WHERE infra_id = $2"
                )
                };

                let layer = sql_query(sql)
                    .bind::<BigInt, _>(cloned_infra.id)
                    .bind::<BigInt, _>(self.id)
                    .execute(&mut conn);
                futures.push(layer);
            }
        }

        // Add error layers
        let error_layer = sql_query("INSERT INTO infra_layer_error(geographic, schematic, information, infra_id, info_hash) SELECT geographic, schematic, information, $1, info_hash FROM infra_layer_error WHERE infra_id = $2")
        .bind::<BigInt, _>(cloned_infra.id)
        .bind::<BigInt, _>(self.id)
        .execute(&mut conn);
        futures.push(error_layer);

        let _res = try_join_all(futures).await?;
        Ok(cloned_infra)
    }

    /// Refreshes generated data if not up to date and returns whether they were refreshed.
    /// `force` argument allows us to refresh it in any cases.
    /// This function will update `generated_version` accordingly.
    /// If refreshed you need to call `invalidate_after_refresh` to invalidate layer cache
    pub async fn refresh(
        &mut self,
        db_pool: Arc<DbConnectionPool>,
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
        let mut conn = db_pool.get().await?;
        self.bump_generated_version(&mut conn).await?;

        Ok(true)
    }

    /// Clear generated data of the infra
    /// This function will update `generated_version` acordingly.
    pub async fn clear(&mut self, conn: &mut DbConnection) -> Result<bool> {
        // TODO: lock self for update
        generated_data::clear_all(conn, self.id).await?;
        self.generated_version = None;
        self.save(conn).await?;
        Ok(true)
    }

    pub async fn get_voltages(
        &self,
        conn: &mut DbConnection,
        include_rolling_stock_modes: bool,
    ) -> Result<Vec<Voltage>> {
        let query = if !include_rolling_stock_modes {
            include_str!("infra/sql/get_voltages_without_rolling_stocks_modes.sql")
        } else {
            include_str!("infra/sql/get_voltages_with_rolling_stocks_modes.sql")
        };
        let voltages = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .load::<Voltage>(conn)
            .await?;
        Ok(voltages)
    }

    pub async fn get_all_voltages(conn: &mut DbConnection) -> Result<Vec<Voltage>> {
        let query = include_str!("infra/sql/get_all_voltages_and_modes.sql");
        let voltages = sql_query(query).load::<Voltage>(conn).await?;
        Ok(voltages)
    }

    pub async fn get_speed_limit_tags(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Vec<SpeedLimitTags>> {
        let query = include_str!("infra/sql/get_speed_limit_tags.sql");
        let speed_limits_tags = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .load::<SpeedLimitTags>(conn)
            .await?;
        Ok(speed_limits_tags)
    }

    pub async fn get_splited_track_section_with_data(
        &self,
        conn: &mut DbConnection,
        track: Identifier,
        distance_fraction: f64,
    ) -> Result<Vec<SplitedTrackSectionWithData>> {
        let query = format!("SELECT
            object_table.obj_id as obj_id,
            object_table.data as railjson,
            ST_AsGeoJSON(ST_LineSubstring(ST_GeomFromGeoJSON(object_table.data->'geo'), 0, $3))::jsonb as left_geo,
	        ST_AsGeoJSON(ST_LineSubstring(ST_GeomFromGeoJSON(object_table.data->'geo'), $3, 1))::jsonb as right_geo
            FROM {} AS object_table
            WHERE object_table.infra_id = $1 AND object_table.obj_id = $2",
            get_table(&ObjectType::TrackSection),
        );
        let result = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(track.to_string())
            .bind::<Double, _>(distance_fraction)
            .load::<SplitedTrackSectionWithData>(conn)
            .await?;
        Ok(result)
    }
}

#[async_trait]
impl List<NoParams> for Infra {
    async fn list_conn(
        conn: &mut DbConnection,
        page: i64,
        page_size: i64,
        _: NoParams,
    ) -> Result<PaginatedResponse<Self>> {
        let PaginatedResponse {
            count,
            previous,
            next,
            results,
        } = dsl::infra
            .distinct()
            .paginate(page, page_size)
            .load_and_count::<Row<Self>>(conn)
            .await?;
        Ok(PaginatedResponse {
            count,
            previous,
            next,
            results: results.into_iter().map(Self::from_row).collect(),
        })
    }
}

#[cfg(test)]
pub mod tests {
    use actix_web::test as actix_test;
    use diesel::result::Error;
    use diesel_async::scoped_futures::ScopedBoxFuture;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use diesel_async::AsyncConnection;
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
    use rstest::rstest;
    use uuid::Uuid;

    use super::Infra;
    use crate::error::EditoastError;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::small_infra;
    use crate::fixtures::tests::IntoFixture;
    use crate::modelsv2::infra::DEFAULT_INFRA_VERSION;
    use crate::modelsv2::prelude::*;
    use crate::modelsv2::railjson::find_all_schemas;
    use crate::modelsv2::railjson::RailJsonError;
    use crate::modelsv2::DbConnection;

    pub async fn test_infra_transaction<'a, F>(fn_test: F)
    where
        F: for<'r> FnOnce(&'r mut DbConnection, Infra) -> ScopedBoxFuture<'a, 'r, ()> + Send + 'a,
    {
        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();
        conn.test_transaction::<_, Error, _>(|conn| {
            async move {
                let infra = Infra::changeset()
                    .name("test_infra".to_owned())
                    .last_railjson_version()
                    .create(conn)
                    .await
                    .expect("infra should be created properly");
                fn_test(conn, infra).await;
                Ok(())
            }
            .scope_boxed()
        })
        .await;
    }

    #[actix_test]
    async fn create_infra() {
        test_infra_transaction(|_, infra| {
            async move {
                assert_eq!(infra.owner, Uuid::nil());
                assert_eq!(infra.railjson_version, RAILJSON_VERSION);
                assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
                assert_eq!(infra.generated_version, None);
                assert!(!infra.locked);
            }
            .scope_boxed()
        })
        .await;
    }

    #[rstest]
    async fn clone_infra_with_new_name_returns_new_cloned_infra() {
        // GIVEN
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let infra_new_name = "clone_infra_with_new_name_returns_new_cloned_infra".to_string();

        // WHEN
        let result = small_infra
            .clone(pg_db_pool.clone(), Some(infra_new_name.clone()))
            .await;

        // THEN
        let infra = result
            .expect("could not clone infra")
            .into_fixture(pg_db_pool);
        assert_eq!(infra.name, infra_new_name);
    }

    #[rstest]
    async fn clone_infra_without_new_name_returns_new_cloned_infra() {
        // GIVEN
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;

        // WHEN
        let result = small_infra.clone(pg_db_pool.clone(), None).await;

        // THEN
        let infra = result
            .expect("could not clone infra")
            .into_fixture(pg_db_pool);
        assert_eq!(infra.name, format!("{} (copy)", small_infra.name));
    }

    #[actix_test]
    async fn persists_railjson_ko_version() {
        let pool = db_pool();
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = Infra::changeset()
            .name("test".to_owned())
            .last_railjson_version()
            .persist(railjson_with_invalid_version, pool)
            .await;
        assert!(res.is_err());
        let expected_error = RailJsonError::UnsupportedVersion {
            actual: "0".to_string(),
            expected: RAILJSON_VERSION.to_string(),
        };
        assert_eq!(res.unwrap_err().get_type(), expected_error.get_type());
    }

    #[rstest]
    // The fixture leaks the persisted infra because we explicitely opened a
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

        let pool = db_pool();
        let infra = Infra::changeset()
            .name("persist_railjson_ok_infra".to_owned())
            .last_railjson_version()
            .persist(railjson.clone(), pool.clone())
            .await
            .expect("could not persist infra")
            .into_fixture(pool.clone());

        // THEN
        assert_eq!(infra.railjson_version, railjson.version);

        fn sort<T: OSRDIdentified>(mut objects: Vec<T>) -> Vec<T> {
            objects.sort_by(|a, b| a.get_id().cmp(b.get_id()));
            objects
        }

        let conn = &mut pool.get().await.unwrap();
        let id = infra.id;

        assert_eq!(
            sort::<BufferStop>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.buffer_stops)
        );
        assert_eq!(
            sort::<Route>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.routes)
        );
        assert_eq!(
            sort::<SwitchType>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.extended_switch_types)
        );
        assert_eq!(
            sort::<Switch>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.switches)
        );
        assert_eq!(
            sort::<TrackSection>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.track_sections)
        );
        assert_eq!(
            sort::<SpeedSection>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.speed_sections)
        );
        assert_eq!(
            sort::<NeutralSection>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.neutral_sections)
        );
        assert_eq!(
            sort::<Electrification>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.electrifications)
        );
        assert_eq!(
            sort::<Signal>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.signals)
        );
        assert_eq!(
            sort::<Detector>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.detectors)
        );
        assert_eq!(
            sort::<OperationalPoint>(find_all_schemas(conn, id).await.unwrap()),
            sort(railjson.operational_points)
        );
    }
}
