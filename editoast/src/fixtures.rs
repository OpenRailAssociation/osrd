#[allow(dead_code)]
#[cfg(test)]
pub mod tests {
    use std::io::Cursor;
    use std::ops::{Deref, DerefMut};
    use std::sync::Arc;

    use editoast_models::db_connection_pool::create_connection_pool;
    use editoast_models::DbConnectionPool;

    use crate::client::PostgresConfig;
    use crate::{
        models::Identifiable,
        modelsv2::{
            self, projects::Tags, scenario::Scenario as ScenarioV2,
            timetable::Timetable as TimetableV2, train_schedule::TrainSchedule as TrainScheduleV2,
            Changeset, Document, Infra, Model, Project, RollingStockModel, Study,
        },
        views::{
            rolling_stocks::rolling_stock_form::RollingStockForm,
            v2::train_schedule::TrainScheduleForm,
        },
    };

    use chrono::Utc;
    use editoast_schemas::infra::RailJson;
    use editoast_schemas::rolling_stock::RollingStock;
    use editoast_schemas::train_schedule::TrainScheduleBase;
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

    pub fn get_fast_rolling_stock_form(name: &str) -> RollingStockForm {
        let mut rolling_stock_form: RollingStockForm =
            serde_json::from_str(include_str!("./tests/example_rolling_stock_1.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = name.to_string();
        rolling_stock_form
    }

    pub fn get_fast_rolling_stock_schema(name: &str) -> RollingStock {
        let mut rolling_stock_form: RollingStock =
            serde_json::from_str(include_str!("./tests/example_rolling_stock_1.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = name.to_string();
        rolling_stock_form
    }

    pub async fn named_fast_rolling_stock(
        name: &str,
        db_pool: Arc<DbConnectionPool>,
    ) -> TestFixture<RollingStockModel> {
        let mut rs: Changeset<RollingStockModel> = get_fast_rolling_stock_form(name).into();
        rs = rs.version(0);
        TestFixture::create(rs, db_pool).await
    }

    pub fn get_other_rolling_stock_form(name: &str) -> RollingStockForm {
        let mut rolling_stock_form: RollingStockForm = serde_json::from_str(include_str!(
            "./tests/example_rolling_stock_2_energy_sources.json"
        ))
        .expect("Unable to parse");
        rolling_stock_form.name = name.to_string();
        rolling_stock_form
    }

    pub fn get_trainschedule_json_array() -> &'static str {
        include_str!("./tests/train_schedules/simple_array.json")
    }

    #[derive(Debug)]
    pub struct TrainScheduleV2FixtureSet {
        pub train_schedule: TestFixture<TrainScheduleV2>,
        pub timetable: TestFixture<TimetableV2>,
    }

    #[fixture]
    pub async fn train_schedule_v2(
        #[future] timetable_v2: TestFixture<TimetableV2>,
        db_pool: Arc<DbConnectionPool>,
    ) -> TrainScheduleV2FixtureSet {
        let timetable = timetable_v2.await;
        let train_schedule = make_simple_train_schedule_v2(timetable.id(), db_pool).await;

        TrainScheduleV2FixtureSet {
            train_schedule,
            timetable,
        }
    }

    pub async fn make_simple_train_schedule_v2(
        timetable_id: i64,
        db_pool: Arc<DbConnectionPool>,
    ) -> TestFixture<TrainScheduleV2> {
        let train_schedule_base: TrainScheduleBase =
            serde_json::from_str(include_str!("./tests/train_schedules/simple.json"))
                .expect("Unable to parse");
        let train_schedule_form = TrainScheduleForm {
            timetable_id: Some(timetable_id),
            train_schedule: train_schedule_base,
        };

        TestFixture::create(train_schedule_form.into(), db_pool).await
    }

    pub struct StudyFixtureSet {
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
    }

    #[fixture]
    pub async fn study_fixture_set(
        db_pool: Arc<DbConnectionPool>,
        #[future] project: TestFixture<Project>,
    ) -> StudyFixtureSet {
        let project = project.await;
        let study_model = Study::changeset()
            .name("test_study".into())
            .creation_date(Utc::now().naive_utc())
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
            .budget(Some(0))
            .tags(Tags::default())
            .state("some_state".into())
            .project_id(project.id());
        StudyFixtureSet {
            project,
            study: TestFixture::create(study_model, db_pool).await,
        }
    }

    #[fixture]
    pub async fn project(db_pool: Arc<DbConnectionPool>) -> TestFixture<Project> {
        let project_model = Project::changeset()
            .name("test_project".to_owned())
            .budget(Some(0))
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
            .tags(Tags::default());
        TestFixture::create(project_model, db_pool).await
    }

    #[fixture]
    pub async fn timetable_v2(db_pool: Arc<DbConnectionPool>) -> TestFixture<TimetableV2> {
        TestFixture::new(
            TimetableV2::create(db_pool.get().await.unwrap().deref_mut())
                .await
                .expect("Unable to create timetable"),
            db_pool,
        )
    }

    pub struct ScenarioV2FixtureSet {
        pub project: TestFixture<Project>,
        pub study: TestFixture<Study>,
        pub scenario: TestFixture<ScenarioV2>,
        pub timetable: TestFixture<TimetableV2>,
        pub infra: TestFixture<Infra>,
    }

    #[fixture]
    pub async fn scenario_v2_fixture_set(
        db_pool: Arc<DbConnectionPool>,
        #[future] timetable_v2: TestFixture<TimetableV2>,
        #[future] project: TestFixture<Project>,
    ) -> ScenarioV2FixtureSet {
        let StudyFixtureSet { project, study } = study_fixture_set(db_pool.clone(), project).await;
        let empty_infra = empty_infra(db_pool.clone()).await;
        let timetable = timetable_v2.await;
        let scenario = ScenarioV2::changeset()
            .name("test_scenario_v2".to_string())
            .description("test_scenario_v2 description".to_string())
            .creation_date(Utc::now().naive_utc())
            .last_modification(Utc::now().naive_utc())
            .tags(Tags::default())
            .timetable_id(timetable.model.get_id())
            .study_id(study.model.get_id())
            .infra_id(empty_infra.model.get_id());
        let scenario = TestFixture::create(scenario, db_pool).await;
        ScenarioV2FixtureSet {
            project,
            study,
            scenario,
            timetable,
            infra: empty_infra,
        }
    }

    #[fixture]
    pub async fn document_example(db_pool: Arc<DbConnectionPool>) -> TestFixture<Document> {
        let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
        let mut img_bytes: Vec<u8> = Vec::new();
        assert!(img
            .write_to(&mut Cursor::new(&mut img_bytes), image::ImageFormat::Png)
            .is_ok());
        TestFixture::create(
            Document::changeset()
                .content_type(String::from("img/png"))
                .data(img_bytes),
            db_pool,
        )
        .await
    }

    #[fixture]
    pub async fn empty_infra(db_pool: Arc<DbConnectionPool>) -> TestFixture<Infra> {
        TestFixture::create(
            Infra::changeset()
                .name("test_infra".to_owned())
                .last_railjson_version(),
            db_pool,
        )
        .await
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
