#[cfg(test)]
pub mod tests {
    use crate::client::PostgresConfig;
    use crate::models::{Create, Delete, Identifiable, Project, RollingStockModel};

    use actix_web::web::Data;
    use chrono::Utc;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use futures::executor;
    use rstest::fixture;

    pub struct TestFixture<T: Delete + Identifiable + Send> {
        pub model: T,
        db_pool: Data<Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>>,
    }

    impl<T: Delete + Identifiable + Send> TestFixture<T> {
        pub fn id(&self) -> i64 {
            self.model.get_id()
        }
    }

    impl<T: Delete + Identifiable + Send> Drop for TestFixture<T> {
        fn drop(&mut self) {
            let _ = executor::block_on(T::delete(self.db_pool.clone(), self.id()));
        }
    }

    #[fixture]
    pub fn db_pool() -> Data<Pool<ConnectionManager<diesel::PgConnection>>> {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        Data::new(Pool::builder().max_size(1).build(manager).unwrap())
    }

    #[fixture]
    pub async fn fast_rolling_stock(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<RollingStockModel> {
        TestFixture {
            model: serde_json::from_str::<RollingStockModel>(include_str!(
                "./tests/example_rolling_stock.json"
            ))
            .expect("Unable to parse")
            .create(db_pool.clone())
            .await
            .unwrap(),
            db_pool,
        }
    }

    #[fixture]
    pub async fn project(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<Project> {
        TestFixture {
            model: Project {
                name: Some("_@Test integration project".into()),
                objectives: Some("".into()),
                description: Some("".into()),
                funders: Some("".into()),
                budget: Some(0),
                tags: Some(vec![]),
                creation_date: Some(Utc::now().naive_utc()),
                ..Default::default()
            }
            .create(db_pool.clone())
            .await
            .unwrap(),
            db_pool,
        }
    }
}
