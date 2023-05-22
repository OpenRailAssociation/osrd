#[cfg(test)]
pub mod tests {
    use std::io::Cursor;

    use crate::client::PostgresConfig;
    use crate::models::{
        Create, Delete, Document, Identifiable, Infra, Pathfinding, PathfindingChangeset,
        RollingStockLiveryModel, RollingStockModel,
    };
    use crate::schema::RailJson;
    use crate::views::infra::InfraForm;

    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use futures::executor;
    use postgis_diesel::types::LineString;
    use rstest::*;

    pub struct TestFixture<T: Delete + Identifiable + Send> {
        pub model: T,
        pub db_pool: Data<Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>>,
        pub infra: Option<Infra>,
    }

    impl<T: Delete + Identifiable + Send> TestFixture<T> {
        pub fn id(&self) -> i64 {
            self.model.get_id()
        }
    }

    impl<T: Delete + Identifiable + Send> Drop for TestFixture<T> {
        fn drop(&mut self) {
            let _ = executor::block_on(T::delete(self.db_pool.clone(), self.id()));
            if let Some(infra) = &self.infra {
                let _ = executor::block_on(Infra::delete(self.db_pool.clone(), infra.id.unwrap()));
            }
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
                "./tests/example_rolling_stock_1.json"
            ))
            .expect("Unable to parse")
            .create(db_pool.clone())
            .await
            .unwrap(),
            db_pool,
            infra: None,
        }
    }

    #[fixture]
    pub async fn other_rolling_stock(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<RollingStockModel> {
        TestFixture {
            model: serde_json::from_str::<RollingStockModel>(include_str!(
                "./tests/example_rolling_stock_2_energy_sources.json"
            ))
            .expect("Unable to parse")
            .create(db_pool.clone())
            .await
            .unwrap(),
            db_pool,
            infra: None,
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
            infra: None,
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
            infra: None,
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
            infra: None,
        }
    }

    async fn make_small_infra(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> Infra {
        let railjson: RailJson =
            serde_json::from_str(include_str!("tests/small_infra/small_infra.json")).unwrap();
        let infra = Infra::from(InfraForm {
            name: "small_infra".to_owned(),
        });
        infra.persist(railjson, db_pool).await.unwrap()
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
    pub async fn small_infra(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<Infra> {
        TestFixture {
            model: make_small_infra(db_pool.clone()).await,
            db_pool,
            infra: None,
        }
    }

    #[fixture]
    pub async fn pathfinding(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) -> TestFixture<Pathfinding> {
        let small_infra = make_small_infra(db_pool.clone()).await;
        let pf_cs = PathfindingChangeset {
            infra_id: small_infra.id,
            payload: Some(
                serde_json::from_str(include_str!("tests/pathfinding_payload.json")).unwrap(),
            ),
            slopes: Some(diesel_json::Json(vec![])),
            curves: Some(diesel_json::Json(vec![])),
            geographic: Some(LineString::new(None)),
            schematic: Some(LineString::new(None)),
            owner: Some(Default::default()),
            created: Some(Default::default()),
            ..Default::default()
        };
        let pf = pf_cs.create(db_pool.clone()).await.unwrap().into();
        TestFixture {
            model: pf,
            db_pool,
            infra: Some(small_infra),
        }
    }
}
