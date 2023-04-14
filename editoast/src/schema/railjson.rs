use super::{
    BufferStop, Catenary, Detector, OSRDTyped, OperationalPoint, Route, Signal, SpeedSection,
    Switch, SwitchType, TrackSection, TrackSectionLink,
};
use crate::models::RAILJSON_VERSION;

use derivative::Derivative;
use diesel::{
    sql_query,
    sql_types::{BigInt, Text},
    PgConnection, QueryableByName, RunQueryDsl,
};
use editoast_derive::EditoastError;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use thiserror::Error;

#[derive(Deserialize, Derivative, Serialize, Clone, Debug)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct RailJson {
    #[derivative(Default(value = r#"RAILJSON_VERSION.to_string()"#))]
    pub version: String,
    pub operational_points: Vec<OperationalPoint>,
    pub routes: Vec<Route>,
    pub switch_types: Vec<SwitchType>,
    pub switches: Vec<Switch>,
    pub track_section_links: Vec<TrackSectionLink>,
    pub track_sections: Vec<TrackSection>,
    pub speed_sections: Vec<SpeedSection>,
    pub catenaries: Vec<Catenary>,
    pub signals: Vec<Signal>,
    pub buffer_stops: Vec<BufferStop>,
    pub detectors: Vec<Detector>,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "railjson")]
pub enum RailjsonError {
    #[error("Wrong railjson version '{0}'. Should be {}", RAILJSON_VERSION)]
    WrongVersion(String),
}

#[derive(QueryableByName, Debug, Clone)]
pub struct ObjectQueryable {
    #[diesel(sql_type = Text)]
    pub data: String,
}

struct MyParsedObject<T>(T);

impl<T: DeserializeOwned> From<ObjectQueryable> for MyParsedObject<T> {
    fn from(object: ObjectQueryable) -> Self {
        MyParsedObject(serde_json::from_str(&object.data).expect("Failed to parse object"))
    }
}

pub fn find_objects<T: DeserializeOwned + OSRDTyped>(
    conn: &mut PgConnection,
    infrastructre_id: i64,
) -> Vec<T> {
    sql_query(format!(
        "SELECT data::text FROM {} WHERE infra_id = $1",
        T::get_type().get_table()
    ))
    .bind::<BigInt, _>(infrastructre_id)
    .load::<ObjectQueryable>(conn)
    .expect("Error loading objects")
    .into_iter()
    .map(|obj| MyParsedObject::<T>::from(obj).0)
    .collect()
}

#[cfg(test)]
pub mod test {
    use super::find_objects;
    use crate::client::PostgresConfig;
    use crate::error::EditoastError;
    use crate::error::Result;
    use crate::models::infra::tests::build_test_infra;
    use crate::models::Create;
    use crate::models::Infra;
    use crate::models::RAILJSON_VERSION;
    use crate::schema::OSRDIdentified;
    use crate::schema::{RailJson, RailjsonError};
    use actix_web::test as actix_test;

    use actix_web::web::Data;
    use diesel::r2d2::ConnectionManager;
    use diesel::Connection;
    use diesel::PgConnection;
    use r2d2::Pool;
    use std::collections::HashMap;

    #[actix_test]
    async fn persists_railjson_ko_version() {
        let infra = build_test_infra();
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());
        let infra = infra.create(pool.clone()).await.unwrap();
        let railjson_with_invalid_version = RailJson {
            version: "0".to_string(),
            ..Default::default()
        };
        let res = infra.persist(railjson_with_invalid_version, pool).await;
        assert!(res.is_err());
        let expected_error = RailjsonError::WrongVersion("0".to_string());
        assert_eq!(res.unwrap_err().get_type(), expected_error.get_type(),);
    }

    #[actix_test]
    async fn persist_raijson_ok() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();

        // GIVEN
        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_section_links: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            catenaries: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            version: RAILJSON_VERSION.to_string(),
        };
        let infra: Infra = build_test_infra();

        // WHEN
        let result = infra.persist(railjson.clone(), pool).await;

        // THEN
        assert!(matches!(result, Ok(_)));
        let infra = result.unwrap();

        let s_railjson = find_railjson(&mut conn, &infra).unwrap();

        assert_eq!(infra.railjson_version, railjson.version);
        assert!(check_objects_eq(
            &s_railjson.buffer_stops,
            &railjson.buffer_stops
        ));
        assert!(check_objects_eq(
            &s_railjson.operational_points,
            &railjson.operational_points
        ));
        assert!(check_objects_eq(&s_railjson.routes, &railjson.routes));
        assert!(check_objects_eq(
            &s_railjson.switch_types,
            &railjson.switch_types
        ));
        assert!(check_objects_eq(&s_railjson.switches, &railjson.switches));
        assert!(check_objects_eq(
            &s_railjson.track_section_links,
            &railjson.track_section_links
        ));
        assert!(check_objects_eq(
            &s_railjson.track_sections,
            &railjson.track_sections
        ));
        assert!(check_objects_eq(
            &s_railjson.speed_sections,
            &railjson.speed_sections
        ));
        assert!(check_objects_eq(
            &s_railjson.catenaries,
            &railjson.catenaries
        ));
        assert!(check_objects_eq(&s_railjson.signals, &railjson.signals));
        assert!(check_objects_eq(&s_railjson.detectors, &railjson.detectors));
    }

    fn check_objects_eq<T: PartialEq + OSRDIdentified>(
        objects: &Vec<T>,
        expected: &Vec<T>,
    ) -> bool {
        assert_eq!(objects.len(), expected.len());
        let map_expected: HashMap<_, _> = expected.iter().map(|obj| (obj.get_id(), obj)).collect();

        for obj in objects.iter() {
            match map_expected.get(&obj.get_id()) {
                None => return false,
                Some(expected) => {
                    if &obj != expected {
                        return false;
                    }
                }
            }
        }
        true
    }

    fn find_railjson(conn: &mut PgConnection, infra: &Infra) -> Result<RailJson> {
        let railjson = RailJson {
            version: infra.clone().railjson_version,
            operational_points: find_objects(conn, infra.id.unwrap()),
            routes: find_objects(conn, infra.id.unwrap()),
            switch_types: find_objects(conn, infra.id.unwrap()),
            switches: find_objects(conn, infra.id.unwrap()),
            track_section_links: find_objects(conn, infra.id.unwrap()),
            track_sections: find_objects(conn, infra.id.unwrap()),
            speed_sections: find_objects(conn, infra.id.unwrap()),
            catenaries: find_objects(conn, infra.id.unwrap()),
            signals: find_objects(conn, infra.id.unwrap()),
            buffer_stops: find_objects(conn, infra.id.unwrap()),
            detectors: find_objects(conn, infra.id.unwrap()),
        };

        Ok(railjson)
    }
}
