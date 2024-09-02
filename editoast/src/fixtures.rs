#[allow(dead_code)]
#[cfg(test)]
pub mod tests {
    use std::ops::{Deref, DerefMut};
    use std::sync::Arc;

    use editoast_models::db_connection_pool::create_connection_pool;
    use editoast_models::DbConnectionPool;

    use crate::client::PostgresConfig;
    use crate::{
        models::Identifiable,
        modelsv2::{self, Infra, Model},
    };

    use editoast_schemas::infra::RailJson;
    use futures::executor;
    use rstest::*;
    use std::fmt;

    pub struct TestFixture<T: modelsv2::DeleteStatic<i64> + Identifiable + Send> {
        pub model: T,
        pub db_pool: Arc<DbConnectionPool>,
        pub infra: Option<Infra>,
    }

    impl<T: modelsv2::DeleteStatic<i64> + Identifiable + Send + fmt::Debug> fmt::Debug
        for TestFixture<T>
    {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "Fixture {:?} {:?}", self.model, self.infra)
        }
    }

    impl<T: modelsv2::DeleteStatic<i64> + Identifiable + Send> TestFixture<T> {
        pub fn id(&self) -> i64 {
            self.model.get_id()
        }

        pub fn new(model: T, db_pool: Arc<DbConnectionPool>) -> Self {
            TestFixture {
                model,
                db_pool,
                infra: None,
            }
        }
    }

    impl<T> TestFixture<T>
    where
        T: modelsv2::Model + modelsv2::DeleteStatic<i64> + Identifiable + Send,
        T::Changeset: modelsv2::Create<T> + Send,
    {
        pub async fn create(cs: T::Changeset, db_pool: Arc<DbConnectionPool>) -> Self {
            use modelsv2::Create;
            let conn = &mut db_pool.get().await.unwrap();
            TestFixture {
                model: cs.create(conn).await.unwrap(),
                db_pool,
                infra: None,
            }
        }
    }

    impl<T: modelsv2::DeleteStatic<i64> + Identifiable + Send> Drop for TestFixture<T> {
        fn drop(&mut self) {
            let mut conn = executor::block_on(self.db_pool.get()).unwrap();
            let _ = executor::block_on(T::delete_static(&mut conn, self.id()));
            if let Some(infra) = &self.infra {
                use modelsv2::Delete;
                let _ = executor::block_on(infra.delete(&mut conn));
            }
        }
    }

    pub trait IntoFixture: modelsv2::DeleteStatic<i64> + Identifiable + Send {
        fn into_fixture(self, db_pool: Arc<DbConnectionPool>) -> TestFixture<Self> {
            TestFixture::new(self, db_pool)
        }
    }

    impl<T> IntoFixture for T where T: modelsv2::DeleteStatic<i64> + Identifiable + Send {}

    impl<T> Deref for TestFixture<T>
    where
        T: modelsv2::DeleteStatic<i64> + Identifiable + Send,
    {
        type Target = T;

        fn deref(&self) -> &Self::Target {
            &self.model
        }
    }

    impl<T> DerefMut for TestFixture<T>
    where
        T: modelsv2::DeleteStatic<i64> + Identifiable + Send,
    {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.model
        }
    }

    #[fixture]
    pub fn db_pool() -> Arc<DbConnectionPool> {
        let config = PostgresConfig::default();
        let pg_config_url = config.url().expect("cannot get postgres config url");
        Arc::new(
            create_connection_pool(pg_config_url, config.pool_size).expect("cannot create pool"),
        )
    }

    async fn make_small_infra(db_pool: Arc<DbConnectionPool>) -> Infra {
        let railjson: RailJson = serde_json::from_str(include_str!(
            "../../tests/data/infras/small_infra/infra.json"
        ))
        .unwrap();
        Infra::changeset()
            .name("small_infra".to_owned())
            .last_railjson_version()
            .persist(railjson, db_pool.get().await.unwrap().deref_mut())
            .await
            .unwrap()
    }

    /// Provides an [Infra] based on small_infra
    ///
    /// The infra is imported once for each test using the fixture and
    /// deleted afterwards. The small_infra railjson file is located
    /// at `editoast/tests/small_infra.json`. Any modification of that
    /// file is likely to impact the tests using this fixture. Likewise, if any
    /// modification of the infra itself (cf.
    /// `python/railjson_generator/railjson_generator/scripts/examples/small_infra.py`)
    /// is made, the `editoast/tests/small_infra/small_infra.json` file should be updated
    /// to the latest infra description.
    #[fixture]
    pub async fn small_infra(db_pool: Arc<DbConnectionPool>) -> TestFixture<Infra> {
        TestFixture::new(make_small_infra(db_pool.clone()).await, db_pool)
    }
}
