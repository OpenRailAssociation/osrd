#[cfg(test)]
pub mod tests {
    use std::io::Cursor;

    use crate::client::PostgresConfig;
    use crate::models::train_schedule::Mrsp;
    use crate::models::{
        Create, Delete, Document, ElectricalProfileSet, Identifiable, Infra, Pathfinding,
        PathfindingChangeset, Project, ResultPosition, ResultStops, ResultTrain,
        RollingStockLiveryModel, RollingStockModel, Scenario, SimulationOutput,
        SimulationOutputChangeset, Study, Timetable, TrainSchedule,
    };
    use crate::schema::electrical_profiles::{ElectricalProfile, ElectricalProfileSetData};
    use crate::schema::{RailJson, TrackRange};
    use crate::views::infra::InfraForm;
    use crate::DbPool;

    use actix_web::web::Data;
    use chrono::Utc;
    use diesel_async::pooled_connection::AsyncDieselConnectionManager;
    use diesel_json::Json as DieselJson;
    use futures::executor;
    use postgis_diesel::types::LineString;
    use rstest::*;
    use std::fmt;

    pub struct TestFixture<T: Delete + Identifiable + Send> {
        pub model: T,
        pub db_pool: Data<DbPool>,
        pub infra: Option<Infra>,
    }

    impl<T: fmt::Debug + Delete + Identifiable + Send> fmt::Debug for TestFixture<T> {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "Fixture {:?} {:?}", self.model, self.infra)
        }
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
        let pg_config_url = PostgresConfig::default()
            .url()
            .expect("cannot get postgres config url");
        let config =
            AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(pg_config_url);
        let pool = DbPool::builder(config).build().unwrap();
        Data::new(pool)
    }

    pub fn get_fast_rolling_stock(name: &str) -> RollingStockModel {
        let mut rs: RollingStockModel =
            serde_json::from_str(include_str!("./tests/example_rolling_stock_1.json"))
                .expect("Unable to parse");
        rs.name = Some(name.to_string());
        rs
    }

    pub async fn named_fast_rolling_stock(
        name: &str,
        db_pool: Data<DbPool>,
    ) -> TestFixture<RollingStockModel> {
        let rs = get_fast_rolling_stock(name);
        TestFixture::create(rs, db_pool).await
    }

    pub fn get_other_rolling_stock(name: &str) -> RollingStockModel {
        let mut rs: RollingStockModel = serde_json::from_str(include_str!(
            "./tests/example_rolling_stock_2_energy_sources.json"
        ))
        .expect("Unable to parse");
        rs.name = Some(name.to_string());
        rs
    }

    pub async fn named_other_rolling_stock(
        name: &str,
        db_pool: Data<DbPool>,
    ) -> TestFixture<RollingStockModel> {
        let rs = get_other_rolling_stock(name);
        TestFixture::create(rs, db_pool).await
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
        train_schedule.create(db_pool).await.unwrap()
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

    pub async fn train_schedule_with_scenario(name: &str) -> TrainScheduleFixtureSet {
        let ScenarioFixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra,
        } = scenario_fixture_set().await;

        let pathfinding = pathfinding(db_pool()).await;
        let mut rs_name = "fast_rolling_stock_".to_string();
        rs_name.push_str(name);
        let rolling_stock = named_fast_rolling_stock(&rs_name, db_pool()).await;
        let ts_model = make_train_schedule(
            db_pool(),
            pathfinding.id(),
            timetable.id(),
            rolling_stock.id(),
        )
        .await;
        let train_schedule: TestFixture<TrainSchedule> = TestFixture::new(ts_model, db_pool());
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
    pub async fn scenario_fixture_set() -> ScenarioFixtureSet {
        let project = project(db_pool());
        let StudyFixtureSet { project, study } = study_fixture_set(db_pool(), project).await;
        let empty_infra = empty_infra(db_pool()).await;
        let timetable = timetable(db_pool()).await;
        let scenario_model = Scenario {
            name: Some(String::from("scenario_γ")),
            infra_id: Some(empty_infra.id()),
            timetable_id: Some(timetable.id()),
            study_id: Some(study.id()),
            creation_date: Some(Utc::now().naive_utc()),
            ..Scenario::default()
        };
        let scenario = TestFixture::create(scenario_model, db_pool()).await;
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
    pub struct RollingStockLiveryFixture {
        pub rolling_stock_livery: TestFixture<RollingStockLiveryModel>,
        pub rolling_stock: TestFixture<RollingStockModel>,
        pub image: TestFixture<Document>,
    }

    pub async fn rolling_stock_livery(
        name: &str,
        db_pool: Data<DbPool>,
    ) -> RollingStockLiveryFixture {
        let mut rs_name = "fast_rolling_stock_".to_string();
        rs_name.push_str(name);
        let rolling_stock = named_fast_rolling_stock(&rs_name, db_pool.clone()).await;
        let image = document_example(db_pool.clone()).await;
        let rolling_stock_livery = RollingStockLiveryModel {
            id: None,
            name: Some(String::from("test_livery")),
            rolling_stock_id: Some(rolling_stock.id()),
            compound_image_id: Some(Some(image.id())),
        };
        RollingStockLiveryFixture {
            rolling_stock_livery: TestFixture::create(rolling_stock_livery, db_pool).await,
            rolling_stock,
            image,
        }
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
    pub async fn dummy_electrical_profile_set(
        db_pool: Data<DbPool>,
    ) -> TestFixture<ElectricalProfileSet> {
        let ep_set_data = ElectricalProfileSetData {
            levels: vec![ElectricalProfile {
                value: "A".to_string(),
                power_class: "1".to_string(),
                track_ranges: vec![TrackRange::default()],
            }],
            level_order: Default::default(),
        };
        let ep_set = ElectricalProfileSet {
            id: None,
            name: Some("test".to_string()),
            data: Some(DieselJson::new(ep_set_data.clone())),
        };
        TestFixture::create(ep_set, db_pool).await
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

    pub struct TrainScheduleWithSimulationOutputFixtureSet {
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
        pub scenario: TestFixture<Scenario>,
        pub timetable: TestFixture<Timetable>,
        pub infra: TestFixture<Infra>,
        pub train_schedule: TestFixture<TrainSchedule>,
        pub simulation_output: TestFixture<SimulationOutput>,
        pub pathfinding: TestFixture<Pathfinding>,
        pub rolling_stock: TestFixture<RollingStockModel>,
    }

    pub async fn train_with_simulation_output_fixture_set(
        name: &str,
        db_pool: Data<DbPool>,
    ) -> TrainScheduleWithSimulationOutputFixtureSet {
        let ScenarioFixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra,
        } = scenario_fixture_set().await;

        let mut rs_name = "fast_rolling_stock_".to_string();
        rs_name.push_str(name);
        let rolling_stock = named_fast_rolling_stock(&rs_name, db_pool.clone()).await;
        let pathfinding = pathfinding(db_pool.clone()).await;
        let train_schedule = make_train_schedule(
            db_pool.clone(),
            pathfinding.id(),
            timetable.id(),
            rolling_stock.id(),
        )
        .await;

        let result_train: ResultTrain = ResultTrain {
            stops: vec![
                ResultStops {
                    time: 0.0,
                    duration: 0.0,
                    position: 0.0,
                },
                ResultStops {
                    time: 110.90135448736316,
                    duration: 1.0,
                    position: 2417.6350658673214,
                },
            ],
            head_positions: vec![ResultPosition {
                time: 0.0,
                track_section: "TA7".to_string(),
                offset: 0.0,
                path_offset: 0.0,
            }],
            ..Default::default()
        };

        let simulation_output = SimulationOutputChangeset {
            mrsp: Some(diesel_json::Json(Mrsp::default())),
            base_simulation: Some(diesel_json::Json(result_train)),
            eco_simulation: Some(None),
            electrification_ranges: Some(diesel_json::Json(Vec::default())),
            power_restriction_ranges: Some(diesel_json::Json(Vec::default())),
            train_schedule_id: Some(train_schedule.id),
            ..Default::default()
        };
        let simulation_output: SimulationOutput = simulation_output
            .create(db_pool.clone())
            .await
            .unwrap()
            .into();

        let train_schedule = TestFixture::new(train_schedule, db_pool.clone());
        let simulation_output = TestFixture::new(simulation_output, db_pool);
        TrainScheduleWithSimulationOutputFixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra,
            train_schedule,
            simulation_output,
            pathfinding,
            rolling_stock,
        }
    }
}
