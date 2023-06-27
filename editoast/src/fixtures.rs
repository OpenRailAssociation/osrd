#[cfg(test)]
pub mod tests {
    use std::io::Cursor;

    use crate::client::PostgresConfig;
    use crate::models::{
        Create, Delete, Document, ElectricalProfileSet, Identifiable, Infra, Pathfinding,
        PathfindingChangeset, Project, RollingStockLiveryModel, RollingStockModel, Scenario, Study,
        Timetable, TrainSchedule,
    };
    use crate::schema::RailJson;
    use crate::views::infra::InfraForm;
    use crate::DbPool;

    use actix_web::web::Data;
    use chrono::Utc;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use futures::executor;
    use postgis_diesel::types::LineString;
    use rstest::*;

    #[derive(Debug)]
    pub struct TestFixture<T: Delete + Identifiable + Send> {
        pub model: T,
        pub db_pool: Data<DbPool>,
        pub infra: Option<Infra>,
    }

    impl<T: Delete + Identifiable + Send> TestFixture<T> {
        pub fn id(&self) -> i64 {
            self.model.get_id()
        }

        pub fn new(model: T, db_pool: Data<DbPool>) -> Self {
            TestFixture {
                model,
                db_pool,
                infra: None,
            }
        }
    }

    impl<T: Create + Delete + Identifiable + Send> TestFixture<T> {
        pub async fn create(model: T, db_pool: Data<DbPool>) -> Self {
            TestFixture {
                model: model.create(db_pool.clone()).await.unwrap(),
                db_pool,
                infra: None,
            }
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
    pub fn db_pool() -> Data<DbPool> {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        Data::new(Pool::builder().max_size(1).build(manager).unwrap())
    }

    #[fixture]
    pub async fn fast_rolling_stock(db_pool: Data<DbPool>) -> TestFixture<RollingStockModel> {
        TestFixture::create(
            serde_json::from_str::<RollingStockModel>(include_str!(
                "./tests/example_rolling_stock_1.json"
            ))
            .expect("Unable to parse"),
            db_pool,
        )
        .await
    }

    #[fixture]
    pub async fn other_rolling_stock(db_pool: Data<DbPool>) -> TestFixture<RollingStockModel> {
        TestFixture::create(
            serde_json::from_str::<RollingStockModel>(include_str!(
                "./tests/example_rolling_stock_2_energy_sources.json"
            ))
            .expect("Unable to parse"),
            db_pool,
        )
        .await
    }

    #[fixture]
    pub async fn train_schedule(
        db_pool: Data<DbPool>,
        #[future] pathfinding: TestFixture<Pathfinding>,
        #[future] timetable: TestFixture<Timetable>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) -> TestFixture<TrainSchedule> {
        let pathfinding = pathfinding.await;
        let timetable = timetable.await;
        let rolling_stock = fast_rolling_stock.await;
        let train_schedule = make_train_schedule(
            db_pool.clone(),
            pathfinding.id(),
            timetable.id(),
            rolling_stock.id(),
        )
        .await;
        TestFixture::new(train_schedule, db_pool)
    }

    async fn make_train_schedule(
        db_pool: Data<DbPool>,
        path_id: i64,
        timetable_id: i64,
        rolling_stock_id: i64,
    ) -> TrainSchedule {
        let train_schedule = TrainSchedule {
            path_id,
            timetable_id,
            rolling_stock_id,
            ..serde_json::from_str::<TrainSchedule>(include_str!("./tests/train_schedule.json"))
                .expect("Unable to parse")
        };
        train_schedule.create(db_pool.clone()).await.unwrap()
    }

    #[derive(Debug)]
    pub struct TrainScheduleFixtureSet {
        pub train_schedule: TestFixture<TrainSchedule>,
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
        pub scenario: TestFixture<Scenario>,
        pub timetable: TestFixture<Timetable>,
        pub infra: TestFixture<Infra>,
        pub path: TestFixture<Pathfinding>,
        pub rolling_stock: TestFixture<RollingStockModel>,
    }

    #[fixture]
    pub async fn train_schedule_with_scenario(
        db_pool: Data<DbPool>,
        #[future] pathfinding: TestFixture<Pathfinding>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        #[future] scenario_fixture_set: ScenarioFixtureSet,
    ) -> TrainScheduleFixtureSet {
        let ScenarioFixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra,
        } = scenario_fixture_set.await;

        let pathfinding = pathfinding.await;
        let rolling_stock = fast_rolling_stock.await;
        let ts_model = make_train_schedule(
            db_pool.clone(),
            pathfinding.id(),
            timetable.id(),
            rolling_stock.id(),
        )
        .await;
        let train_schedule = TestFixture::new(ts_model, db_pool);
        TrainScheduleFixtureSet {
            train_schedule,
            project,
            study,
            scenario,
            timetable,
            infra,
            path: pathfinding,
            rolling_stock,
        }
    }

    pub struct ScenarioFixtureSet {
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
        pub scenario: TestFixture<Scenario>,
        pub timetable: TestFixture<Timetable>,
        pub infra: TestFixture<Infra>,
    }

    #[fixture]
    pub async fn scenario_fixture_set(
        db_pool: Data<DbPool>,
        #[future] empty_infra: TestFixture<Infra>,
        #[future] timetable: TestFixture<Timetable>,
        #[future] study_fixture_set: StudyFixtureSet,
    ) -> ScenarioFixtureSet {
        let StudyFixtureSet { project, study } = study_fixture_set.await;
        let empty_infra = empty_infra.await;
        let timetable = timetable.await;
        let scenario_model = Scenario {
            name: Some(String::from("scenario_γ")),
            infra_id: Some(empty_infra.id()),
            timetable_id: Some(timetable.id()),
            study_id: Some(study.id()),
            creation_date: Some(Utc::now().naive_utc()),
            ..Scenario::default()
        };
        let scenario = TestFixture::create(scenario_model, db_pool.clone()).await;
        ScenarioFixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra: empty_infra,
        }
    }

    pub struct StudyFixtureSet {
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
    }

    #[fixture]
    pub async fn study_fixture_set(
        db_pool: Data<DbPool>,
        #[future] project: TestFixture<Project>,
    ) -> StudyFixtureSet {
        let project = project.await;
        let study_model = Study {
            name: Some("test_study".into()),
            project_id: Some(project.id()),
            description: Some("test".into()),
            creation_date: Some(Utc::now().naive_utc()),
            business_code: Some("AAA".into()),
            service_code: Some("BBB".into()),
            state: Some("some_type".into()),
            study_type: Some("some_type".into()),
            budget: Some(0),
            tags: Some(vec![]),
            ..Default::default()
        };
        StudyFixtureSet {
            project,
            study: TestFixture::create(study_model, db_pool).await,
        }
    }

    #[fixture]
    pub async fn project(db_pool: Data<DbPool>) -> TestFixture<Project> {
        let project_model = Project {
            name: Some("test_project".into()),
            objectives: Some("".into()),
            description: Some("".into()),
            funders: Some("".into()),
            budget: Some(0),
            tags: Some(vec![]),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        };
        TestFixture::create(project_model, db_pool).await
    }

    #[fixture]
    pub async fn timetable(db_pool: Data<DbPool>) -> TestFixture<Timetable> {
        let timetable_model = Timetable {
            id: None,
            name: Some(String::from("with_electrical_profiles")),
        };
        TestFixture::create(timetable_model, db_pool).await
    }

    #[fixture]
    pub async fn document_example(db_pool: Data<DbPool>) -> TestFixture<Document> {
        let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
        let mut img_bytes: Vec<u8> = Vec::new();
        assert!(img
            .write_to(
                &mut Cursor::new(&mut img_bytes),
                image::ImageOutputFormat::Png
            )
            .is_ok());
        TestFixture::create(Document::new(String::from("image/png"), img_bytes), db_pool).await
    }

    #[fixture]
    pub async fn rolling_stock_livery(
        db_pool: Data<DbPool>,
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
        TestFixture::create(rolling_stock_livery, db_pool).await
    }

    #[fixture]
    pub async fn electrical_profile_set(
        db_pool: Data<DbPool>,
    ) -> TestFixture<ElectricalProfileSet> {
        TestFixture::create(
            serde_json::from_str::<ElectricalProfileSet>(include_str!(
                "./tests/electrical_profile_set.json"
            ))
            .expect("Unable to parse"),
            db_pool,
        )
        .await
    }

    #[fixture]
    pub async fn empty_infra(db_pool: Data<DbPool>) -> TestFixture<Infra> {
        let infra_form = InfraForm {
            name: String::from("test_infra"),
        };
        TestFixture::create(Infra::from(infra_form), db_pool).await
    }

    async fn make_small_infra(db_pool: Data<DbPool>) -> Infra {
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
    pub async fn small_infra(db_pool: Data<DbPool>) -> TestFixture<Infra> {
        TestFixture::new(make_small_infra(db_pool.clone()).await, db_pool)
    }

    #[fixture]
    pub async fn pathfinding(db_pool: Data<DbPool>) -> TestFixture<Pathfinding> {
        let small_infra = make_small_infra(db_pool.clone()).await;
        let pf_cs = PathfindingChangeset {
            infra_id: small_infra.id,
            payload: Some(
                serde_json::from_str(include_str!(
                    "tests/small_infra/pathfinding_fixture_payload.json"
                ))
                .unwrap(),
            ),
            length: Some(46776.),
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
