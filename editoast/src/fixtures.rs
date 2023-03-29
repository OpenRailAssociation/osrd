#[cfg(test)]
pub mod tests {
    use std::io::Cursor;

    use crate::client::PostgresConfig;
    use crate::models::{
        Create, Delete, Document, Identifiable, Infra, RollingStockLiveryModel, RollingStockModel,
    };
    use crate::views::infra::InfraForm;

    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use futures::executor;
    use rstest::fixture;

    pub struct TestFixture<T: Delete + Identifiable + Send> {
        pub model: T,
        pub db_pool: Data<Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>>,
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
    pub async fn document_example(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<Document> {
        let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
        let mut img_bytes: Vec<u8> = Vec::new();
        assert!(img
            .write_to(
                &mut Cursor::new(&mut img_bytes),
                image::ImageOutputFormat::Png
            )
            .is_ok());
        TestFixture {
            model: Document::new(String::from("image/png"), img_bytes)
                .create(db_pool.clone())
                .await
                .unwrap(),
            db_pool,
        }
    }

    #[fixture]
    pub async fn rolling_stock_livery(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        #[future] document_example: TestFixture<Document>,
    ) -> TestFixture<RollingStockLiveryModel> {
        let rolling_stock = fast_rolling_stock.await;
        let image = document_example.await;
        let rolling_stock_livery = RollingStockLiveryModel {
            id: None,
            name: Some(String::from("test_livery")),
            rolling_stock_id: Some(rolling_stock.id()),
            compound_image_id: Some(Some(image.id())),
        };
        TestFixture {
            model: rolling_stock_livery.create(db_pool.clone()).await.unwrap(),
            db_pool,
        }
    }

    #[fixture]
    pub async fn empty_infra(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<Infra> {
        let infra_form = InfraForm {
            name: String::from("test_infra"),
        };
        TestFixture {
            model: Infra::from(infra_form)
                .create(db_pool.clone())
                .await
                .unwrap(),
            db_pool,
        }
    }
}
