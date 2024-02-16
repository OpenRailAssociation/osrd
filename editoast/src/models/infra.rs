use std::pin::Pin;

use super::{Create, Delete, List, NoParams, Update};
use crate::{
    error::Result,
    generated_data,
    infra_cache::InfraCache,
    models::{Identifiable, Retrieve},
    modelsv2::{get_geometry_layer_table, get_table, railjson::persist_railjson},
    schema::{ObjectType, RailJson, RAILJSON_VERSION},
    tables::infra::{self, dsl},
    views::pagination::{Paginate, PaginatedResponse},
    DbPool,
};

use actix_web::web::Data;
use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::{
    result::Error as DieselError,
    sql_query,
    sql_types::{BigInt, Bool, Nullable, Text},
    ExpressionMethods, QueryDsl,
};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::{EditoastError, Model};
use futures::future::try_join_all;
use futures::Future;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use thiserror::Error;
use tracing::{debug, error};
use uuid::Uuid;

pub const INFRA_VERSION: &str = "0";

#[derive(
    Clone,
    QueryableByName,
    Queryable,
    Debug,
    Serialize,
    Insertable,
    Deserialize,
    Identifiable,
    Model,
    AsChangeset,
    Derivative,
)]
#[diesel(table_name = infra)]
#[model(retrieve, delete, create, update)]
#[model(table = "infra")]
#[derivative(Default)]
pub struct Infra {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub railjson_version: Option<String>,
    #[serde(skip_serializing)]
    #[diesel(deserialize_as = Uuid)]
    pub owner: Option<Uuid>,
    #[diesel(deserialize_as = String)]
    pub version: Option<String>,
    #[diesel(deserialize_as = Option<String>)]
    pub generated_version: Option<Option<String>>,
    #[diesel(deserialize_as = bool)]
    pub locked: Option<bool>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub created: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub modified: NaiveDateTime,
}

impl Infra {
    pub async fn retrieve_for_update(conn: &mut PgConnection, infra_id: i64) -> Result<Infra> {
        let infra = dsl::infra.for_update().find(infra_id).first(conn).await?;
        Ok(infra)
    }

    pub async fn list_for_update(conn: &mut PgConnection) -> Vec<Infra> {
        dsl::infra
            .for_update()
            .load::<Self>(conn)
            .await
            .expect("List infra query failed")
    }

    pub async fn all(conn: &mut PgConnection) -> Vec<Infra> {
        dsl::infra
            .load::<Self>(conn)
            .await
            .expect("List infra query failed")
    }

    pub async fn bump_version(&self, conn: &mut PgConnection) -> Result<Self> {
        let new_version = self
            .version
            .as_ref()
            .unwrap()
            .parse::<u32>()
            .expect("Cannot convert version into an Integer")
            + 1;
        let infra_id = self.id.unwrap();
        let new_version = new_version.to_string();
        let mut infra = self.clone();
        infra.version = Some(new_version);
        let infra = infra.update_conn(conn, infra_id).await?.unwrap();
        Ok(infra)
    }

    pub async fn persist(self, railjson: RailJson, db_pool: Data<DbPool>) -> Result<Infra> {
        let conn = &mut db_pool.get().await?;
        let infra = self.create_conn(conn).await?;
        let infra_id = infra.id.unwrap();
        debug!("🛤  Begin importing all railjson objects");
        if let Err(e) = persist_railjson(db_pool.into_inner(), infra_id, railjson).await {
            error!("Could not import infrastructure {infra_id}. Rolling back");
            Infra::delete_conn(conn, infra_id).await?;
            return Err(e);
        };
        debug!("🛤  Import finished successfully");
        Ok(infra)
    }

    pub async fn clone(
        infra_id: i64,
        db_pool: Data<DbPool>,
        new_name: Option<String>,
    ) -> Result<Infra> {
        // Duplicate infra shell
        let infra_to_clone = Infra::retrieve(db_pool.clone(), infra_id)
            .await?
            .ok_or(InfraError::NotFound { infra_id })?;
        let new_name = new_name.unwrap_or_else(|| {
            let mut cloned_name = infra_to_clone.name.unwrap();
            cloned_name.push_str(" (copy)");
            cloned_name
        });
        let mut conn = db_pool.get().await?;
        let cloned_infra = sql_query(
            "INSERT INTO infra (name, railjson_version, owner, version, generated_version, locked, created, modified
            )
            SELECT $1, $2, '00000000-0000-0000-0000-000000000000', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM infra
             WHERE id = $6
             RETURNING *",
        )
        .bind::<Text, _>(new_name)
        .bind::<Text, _>(RAILJSON_VERSION)
        .bind::<Text,_>(infra_to_clone.version.unwrap())
        .bind::<Nullable<Text>,_>(infra_to_clone.generated_version.unwrap())
        .bind::<Bool,_>(infra_to_clone.locked.unwrap())
        .bind::<BigInt,_>(infra_id)
        .get_result::<Infra>(&mut conn).await?;

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
            .bind::<BigInt, _>(cloned_infra.id.unwrap())
            .bind::<BigInt, _>(infra_id)
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
                    .bind::<BigInt, _>(cloned_infra.id.unwrap())
                    .bind::<BigInt, _>(infra_id)
                    .execute(&mut conn);
                futures.push(layer);
            }
        }

        // Add error layers
        let error_layer = sql_query("INSERT INTO infra_layer_error(geographic, schematic, information, infra_id, info_hash) SELECT geographic, schematic, information, $1, info_hash FROM infra_layer_error WHERE infra_id = $2")
        .bind::<BigInt, _>(cloned_infra.id.unwrap())
        .bind::<BigInt, _>(infra_id)
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
        &self,
        db_pool: Data<crate::DbPool>,
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

        generated_data::refresh_all(db_pool.clone(), self.id.unwrap(), infra_cache).await?;

        // Update generated infra version
        let mut infra = self.clone();
        infra.generated_version = Some(self.version.clone());
        let mut conn = db_pool.get().await?;
        infra.update_conn(&mut conn, self.id.unwrap()).await?;

        Ok(true)
    }

    /// Clear generated data of the infra
    /// This function will update `generated_version` acordingly.
    pub async fn clear(&self, conn: &mut PgConnection) -> Result<bool> {
        generated_data::clear_all(conn, self.clone().id.unwrap()).await?;
        let mut infra = self.clone();
        infra.generated_version = Some(None);
        infra.update_conn(conn, self.id.unwrap()).await?;
        Ok(true)
    }
}

#[async_trait]
impl List<NoParams> for Infra {
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        _: NoParams,
    ) -> Result<PaginatedResponse<Self>> {
        dsl::infra
            .distinct()
            .paginate(page, page_size)
            .load_and_count(conn)
            .await
    }
}

impl Identifiable for Infra {
    fn get_id(&self) -> i64 {
        self.id.unwrap()
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra")]
pub enum InfraError {
    #[error("Infrastructure not found, ID : {infra_id}")]
    NotFound { infra_id: i64 },
}

#[cfg(test)]
pub mod tests {
    use super::Infra;
    use crate::{
        client::PostgresConfig,
        error::EditoastError,
        fixtures::tests::{db_pool, small_infra},
        models::{
            infra::{InfraError, INFRA_VERSION},
            Create,
        },
        modelsv2::railjson::{find_all_schemas, RailJsonError},
        schema::{RailJson, RAILJSON_VERSION},
        Data, DbPool,
    };
    use actix_web::test as actix_test;
    use chrono::Utc;
    use diesel::{result::Error, sql_query, sql_types::Text};
    use diesel_async::{
        scoped_futures::{ScopedBoxFuture, ScopedFutureExt},
        AsyncConnection, AsyncPgConnection as PgConnection, RunQueryDsl,
    };
    use rstest::rstest;
    use uuid::Uuid;

    pub fn build_test_infra() -> Infra {
        Infra {
            name: Some("test".into()),
            created: Some(Utc::now().naive_utc()),
            owner: Some(Uuid::nil()),
            railjson_version: Some(RAILJSON_VERSION.into()),
            version: Some(INFRA_VERSION.into()),
            generated_version: Some(Some(INFRA_VERSION.into())),
            locked: Some(false),
            ..Default::default()
        }
    }

    pub async fn test_infra_transaction<'a, F>(fn_test: F)
    where
        F: for<'r> FnOnce(&'r mut PgConnection, Infra) -> ScopedBoxFuture<'a, 'r, ()> + Send + 'a,
    {
        let infra = build_test_infra();
        let pg_config_url = PostgresConfig::default()
            .url()
            .expect("cannot get postgres config url");
        let mut conn = PgConnection::establish(pg_config_url.as_str())
            .await
            .unwrap();
        let _ = conn
            .test_transaction::<_, Error, _>(|conn| {
                async move {
                    let infra = infra.create_conn(conn).await.unwrap();
                    fn_test(conn, infra).await;
                    Ok(())
                }
                .scope_boxed()
            })
            .await;
    }

    pub async fn test_infra_and_delete<'a, F>(fn_test: F)
    where
        F: for<'r> FnOnce(Data<DbPool>, Infra) -> ScopedBoxFuture<'a, 'a, ()> + Send + 'a,
    {
        use crate::models::Delete;
        let db_pool = db_pool();
        let infra = build_test_infra();
        let created = infra.create(db_pool.clone()).await.unwrap();
        let id = created.id.unwrap();
        fn_test(db_pool.clone(), created).await;
        let _ = Infra::delete(db_pool, id).await;
    }

    #[actix_test]
    async fn create_infra() {
        test_infra_transaction(|_, infra| {
            async move {
                assert_eq!("test", infra.name.unwrap());
                assert_eq!(Uuid::nil(), infra.owner.unwrap());
                assert_eq!(RAILJSON_VERSION, infra.railjson_version.unwrap());
                assert_eq!(INFRA_VERSION, infra.version.unwrap());
                assert_eq!(INFRA_VERSION, infra.generated_version.unwrap().unwrap());
                assert!(!infra.locked.unwrap());
            }
            .scope_boxed()
        })
        .await;
    }

    #[rstest]
    async fn clone_infra_with_new_name_returns_new_cloned_infra() {
        // GIVEN
        let pg_db_pool = db_pool();
        let small_infra = &small_infra(pg_db_pool.clone()).await.model;
        let infra_new_name = "clone_infra_with_new_name_returns_new_cloned_infra".to_string();

        // WHEN
        let result = Infra::clone(
            small_infra.id.unwrap(),
            pg_db_pool,
            Some(infra_new_name.clone()),
        )
        .await;

        // THEN
        assert!(result.is_ok());
        assert_eq!(result.unwrap().name, Some(infra_new_name.clone()));

        // CLEANUP
        let pg_config = PostgresConfig::default();
        let pg_config_url = pg_config.url().expect("cannot get postgres config url");
        let mut conn = PgConnection::establish(pg_config_url.as_str())
            .await
            .expect("Error while connecting DB");
        sql_query("DELETE FROM infra WHERE name = $1")
            .bind::<Text, _>(infra_new_name)
            .execute(&mut conn)
            .await
            .unwrap();
    }

    #[rstest]
    async fn clone_infra_without_new_name_returns_new_cloned_infra() {
        // GIVEN
        let pg_db_pool = db_pool();
        let small_infra = &small_infra(pg_db_pool.clone()).await.model;

        // WHEN
        let result = Infra::clone(small_infra.id.unwrap(), pg_db_pool, None).await;

        // THEN
        assert!(result.is_ok());
        let mut new_name = small_infra.name.clone().unwrap();
        new_name.push_str(" (copy)");
        assert_eq!(result.unwrap().name.unwrap(), new_name);

        // CLEANUP
        let pg_config = PostgresConfig::default();
        let pg_config_url = pg_config.url().expect("cannot get postgres config url");
        let mut conn = PgConnection::establish(pg_config_url.as_str())
            .await
            .expect("Error while connecting DB");
        sql_query("DELETE FROM infra WHERE name = $1")
            .bind::<Text, _>(new_name)
            .execute(&mut conn)
            .await
            .unwrap();
    }

    #[actix_test]
    async fn clone_infra_returns_infra_not_found() {
        // GIVEN
        let not_found_infra_id: i64 = 1234567890;

        // WHEN
        let result = Infra::clone(not_found_infra_id, db_pool(), None).await;

        // THEN
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            InfraError::NotFound {
                infra_id: not_found_infra_id
            }
            .into(),
            "error type mismatch"
        );
    }

    #[actix_test]
    async fn persists_railjson_ko_version() {
        let infra = build_test_infra();
        let pool = db_pool();
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = infra.persist(railjson_with_invalid_version, pool).await;
        assert!(res.is_err());
        let expected_error = RailJsonError::UnsupportedVersion {
            actual: "0".to_string(),
            expected: RAILJSON_VERSION.to_string(),
        };
        assert_eq!(res.unwrap_err().get_type(), expected_error.get_type());
    }

    #[actix_test]
    async fn persist_railjson_ok() {
        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();

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
        let infra: Infra = build_test_infra();

        // WHEN
        let result = infra.persist(railjson.clone(), pool).await;

        // THEN
        let infra_res = result.expect("unexpected infra.persist failure");
        assert_eq!(infra_res.railjson_version.unwrap(), railjson.version);

        let id = infra_res.id.unwrap();
        fn sort<T: OSRDIdentified>(mut objects: Vec<T>) -> Vec<T> {
            objects.sort_by(|a, b| a.get_id().cmp(b.get_id()));
            objects
        }

        use crate::schema::*;
        assert_eq!(
            sort::<BufferStop>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.buffer_stops)
        );
        assert_eq!(
            sort::<Route>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.routes)
        );
        assert_eq!(
            sort::<SwitchType>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.extended_switch_types)
        );
        assert_eq!(
            sort::<Switch>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.switches)
        );
        assert_eq!(
            sort::<TrackSection>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.track_sections)
        );
        assert_eq!(
            sort::<SpeedSection>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.speed_sections)
        );
        assert_eq!(
            sort::<NeutralSection>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.neutral_sections)
        );
        assert_eq!(
            sort::<Electrification>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.electrifications)
        );
        assert_eq!(
            sort::<Signal>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.signals)
        );
        assert_eq!(
            sort::<Detector>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.detectors)
        );
        assert_eq!(
            sort::<OperationalPoint>(find_all_schemas(&mut conn, id).await.unwrap()),
            sort(railjson.operational_points)
        );
    }
}
