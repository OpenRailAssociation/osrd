use super::{
    BufferStop, Detector, Electrification, NeutralSection, OperationalPoint, Route, Signal,
    SpeedSection, Switch, SwitchType, TrackSection,
};

use derivative::Derivative;
use serde::{Deserialize, Serialize};

pub const RAILJSON_VERSION: &str = "3.4.8";

#[derive(Deserialize, Derivative, Serialize, Clone, Debug)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct RailJson {
    #[derivative(Default(value = r#"RAILJSON_VERSION.to_string()"#))]
    pub version: String,
    pub operational_points: Vec<OperationalPoint>,
    pub routes: Vec<Route>,
    pub extended_switch_types: Vec<SwitchType>,
    pub switches: Vec<Switch>,
    pub track_sections: Vec<TrackSection>,
    pub speed_sections: Vec<SpeedSection>,
    pub neutral_sections: Vec<NeutralSection>,
    pub electrifications: Vec<Electrification>,
    pub signals: Vec<Signal>,
    pub buffer_stops: Vec<BufferStop>,
    pub detectors: Vec<Detector>,
}

#[cfg(test)]
pub mod test {
    use crate::client::PostgresConfig;
    use crate::error::EditoastError;
    use crate::models::infra::tests::build_test_infra;
    use crate::models::Infra;
    use crate::modelsv2::railjson::find_all_schemas;
    use crate::modelsv2::railjson::RailJsonError;
    use crate::schema::RailJson;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel_async::pooled_connection::deadpool::Pool;
    use diesel_async::pooled_connection::AsyncDieselConnectionManager as ConnectionManager;
    use diesel_async::AsyncPgConnection as PgConnection;

    #[actix_test]
    async fn persists_railjson_ko_version() {
        let infra = build_test_infra();
        let pg_config_url = PostgresConfig::default()
            .url()
            .expect("cannot get postgres config url");
        let manager = ConnectionManager::<PgConnection>::new(pg_config_url);
        let pool = Data::new(Pool::builder(manager).max_size(1).build().unwrap());
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = infra.persist(railjson_with_invalid_version, pool).await;
        assert!(res.is_err());
        let expected_error = RailJsonError::UnsupportedVersion("0".to_string());
        assert_eq!(res.unwrap_err().get_type(), expected_error.get_type(),);
    }

    #[actix_test]
    async fn persist_railjson_ok() {
        let pg_config_url = PostgresConfig::default()
            .url()
            .expect("cannot get postgres config url");
        let manager = ConnectionManager::<PgConnection>::new(pg_config_url);
        let pool = Data::new(Pool::builder(manager).build().unwrap());
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
