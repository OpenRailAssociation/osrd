use super::{Create, Delete, List, NoParams, Update};
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::{Identifiable, Retrieve};
use crate::schema::{
    BufferStop, Catenary, Detector, NeutralSection, OperationalPoint, RailJson, RailjsonError,
    Route, Signal, SpeedSection, Switch, SwitchType, TrackSection, TrackSectionLink,
};
use crate::tables::osrd_infra_infra;
use crate::tables::osrd_infra_infra::dsl;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::{generated_data, DbPool};
use actix_web::web::Data;
use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_types::{BigInt, Bool, Nullable, Text};
use diesel::{sql_query, ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::Model;
use log::{debug, error};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const RAILJSON_VERSION: &str = "3.4.1";
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
#[diesel(table_name = osrd_infra_infra)]
#[model(retrieve, delete, create, update)]
#[model(table = "osrd_infra_infra")]
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
        let infra = dsl::osrd_infra_infra
            .for_update()
            .find(infra_id)
            .first(conn)
            .await?;
        Ok(infra)
    }

    pub async fn list_for_update(conn: &mut PgConnection) -> Vec<Infra> {
        dsl::osrd_infra_infra
            .for_update()
            .load::<Self>(conn)
            .await
            .expect("List infra query failed")
    }

    pub async fn all(conn: &mut PgConnection) -> Vec<Infra> {
        dsl::osrd_infra_infra
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
        if railjson.version != RAILJSON_VERSION {
            return Err(RailjsonError::WrongVersion(railjson.version).into());
        }
        let mut conn = db_pool.get().await?;
        let infra = self.create_conn(&mut conn).await?;
        let infra_id = infra.id.unwrap();

        debug!("🛤  Begin importing all railjson objects");
        let res = futures::try_join!(
            TrackSection::persist_batch_pool(&railjson.track_sections, infra_id, db_pool.clone()),
            TrackSectionLink::persist_batch_pool(
                &railjson.track_section_links,
                infra_id,
                db_pool.clone()
            ),
            BufferStop::persist_batch_pool(&railjson.buffer_stops, infra_id, db_pool.clone()),
            Catenary::persist_batch_pool(&railjson.catenaries, infra_id, db_pool.clone()),
            Detector::persist_batch_pool(&railjson.detectors, infra_id, db_pool.clone()),
            OperationalPoint::persist_batch_pool(
                &railjson.operational_points,
                infra_id,
                db_pool.clone()
            ),
            Route::persist_batch_pool(&railjson.routes, infra_id, db_pool.clone()),
            Signal::persist_batch_pool(&railjson.signals, infra_id, db_pool.clone()),
            Switch::persist_batch_pool(&railjson.switches, infra_id, db_pool.clone()),
            SpeedSection::persist_batch_pool(&railjson.speed_sections, infra_id, db_pool.clone()),
            SwitchType::persist_batch_pool(&railjson.switch_types, infra_id, db_pool.clone()),
            NeutralSection::persist_batch_pool(
                &railjson.neutral_sections,
                infra_id,
                db_pool.clone()
            ),
        );

        match res {
            Err(err) => {
                error!("Could not import infrastructure {infra_id}. Rolling back");
                Infra::delete_conn(&mut conn, infra_id).await?;
                Err(err)
            }
            Ok(_) => {
                debug!("🛤  Import finished successfully");
                Ok(infra)
            }
        }
    }

    pub async fn clone(infra_id: i64, db_pool: Data<DbPool>, new_name: String) -> Result<Infra> {
        let infra_to_clone = Infra::retrieve(db_pool.clone(), infra_id).await?.unwrap();

        let mut conn = db_pool.get().await?;
        sql_query(
            "INSERT INTO osrd_infra_infra (name, railjson_version, owner, version, generated_version, locked, created, modified
            )
            SELECT $1, $2, '00000000-0000-0000-0000-000000000000', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM osrd_infra_infra
             WHERE id = $6
             RETURNING *",
        )
        .bind::<Text, _>(new_name)
        .bind::<Text, _>(RAILJSON_VERSION)
        .bind::<Text,_>(infra_to_clone.version.unwrap())
        .bind::<Nullable<Text>,_>(infra_to_clone.generated_version.unwrap())
        .bind::<Bool,_>(infra_to_clone.locked.unwrap())
        .bind::<BigInt,_>(infra_id)
        .get_result::<Infra>(&mut conn).await.map_err(|err| err.into())
    }

    /// Refreshes generated data if not up to date and returns whether they were refreshed.
    /// `force` argument allows us to refresh it in any cases.
    /// This function will update `generated_version` accordingly.
    /// If refreshed you need to call `invalidate_after_refresh` to invalidate layer cache
    pub async fn refresh(
        &self,
        conn: &mut PgConnection,
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

        generated_data::refresh_all(conn, self.id.unwrap(), infra_cache).await?;

        // Update generated infra version
        let mut infra = self.clone();
        infra.generated_version = Some(self.version.clone());
        infra.update_conn(conn, self.id.unwrap()).await?;

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
        dsl::osrd_infra_infra
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

#[cfg(test)]
pub mod tests {
    use super::Infra;
    use crate::client::PostgresConfig;
    use crate::models::infra::INFRA_VERSION;
    use crate::models::{Create, RAILJSON_VERSION};
    use actix_web::test as actix_test;
    use chrono::Utc;
    use diesel::result::Error;
    use diesel_async::scoped_futures::{ScopedBoxFuture, ScopedFutureExt};
    use diesel_async::{AsyncConnection, AsyncPgConnection as PgConnection};
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
        let mut conn = PgConnection::establish(&PostgresConfig::default().url())
            .await
            .unwrap();
        let _ = conn
            .test_transaction::<_, Error, _>(|conn| {
                async move {
                    let infra = infra.create_conn(conn).await.unwrap();
                    fn_test(conn, infra);
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
}
