use super::{
    BufferStop, Catenary, Detector, OSRDTyped, OperationalPoint, Route, Signal, SpeedSection,
    Switch, SwitchType, TrackSection, TrackSectionLink,
};
use crate::{
    api_error::ApiError,
    infra::{Infra, RAILJSON_VERSION},
};
use derivative::Derivative;

use diesel::{
    sql_query,
    sql_types::{BigInt, Text},
    QueryableByName, RunQueryDsl,
};
use diesel::{Connection, PgConnection};

use rocket::{http::Status, serde::DeserializeOwned};
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Error)]
pub enum RailjsonError {
    #[error("Wrong railjson version '{0}'. Should be {}", RAILJSON_VERSION)]
    RailjsonVersion(String),
}
impl ApiError for RailjsonError {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        "editoast:railjson:WrongVersion"
    }
}

impl RailJson {
    pub fn persist<T: AsRef<str>>(
        &self,
        infra_name: T,
        conn: &mut PgConnection,
    ) -> Result<Infra, Box<dyn ApiError>> {
        if self.version != RAILJSON_VERSION {
            return Err(Box::new(RailjsonError::RailjsonVersion(
                self.version.clone(),
            )));
        }

        conn.transaction(|conn| {
            let infra = Infra::create(infra_name, conn).unwrap();

            BufferStop::persist_batch(&self.buffer_stops, infra.id, conn)?;
            Catenary::persist_batch(&self.catenaries, infra.id, conn)?;
            Detector::persist_batch(&self.detectors, infra.id, conn)?;
            OperationalPoint::persist_batch(&self.operational_points, infra.id, conn)?;
            Route::persist_batch(&self.routes, infra.id, conn)?;
            Signal::persist_batch(&self.signals, infra.id, conn)?;
            Switch::persist_batch(&self.switches, infra.id, conn)?;
            SpeedSection::persist_batch(&self.speed_sections, infra.id, conn)?;
            SwitchType::persist_batch(&self.switch_types, infra.id, conn)?;
            TrackSectionLink::persist_batch(&self.track_section_links, infra.id, conn)?;
            TrackSection::persist_batch(&self.track_sections, infra.id, conn)?;
            Ok(infra)
        })
    }
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
    use crate::api_error::ApiError;
    use crate::infra::Infra;
    use crate::infra::RAILJSON_VERSION;
    use crate::schema::OSRDIdentified;
    use crate::schema::{RailJson, RailjsonError};
    use crate::tests::test_transaction;
    use diesel::PgConnection;
    use std::collections::HashMap;

    #[test]
    fn persists_railjson_ko_version() {
        test_transaction(|conn| {
            let railjson_with_invalid_version = RailJson {
                version: "0".to_string(),
                ..Default::default()
            };

            let res = railjson_with_invalid_version.persist("test", conn);
            assert!(res.is_err());
            let expected_error = RailjsonError::RailjsonVersion("0".to_string());
            assert_eq!(res.unwrap_err().get_type(), expected_error.get_type(),);
        });
    }

    #[test]
    fn persist_raijson_ok() {
        test_transaction(|conn| {
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

            // WHEN
            let result = railjson.persist("test", conn);

            // THEN
            assert!(matches!(result, Ok(_)));
            let infra = result.unwrap();

            let s_railjson = find_railjson(conn, &infra).unwrap();

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
        });
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

    fn find_railjson(
        conn: &mut PgConnection,
        infra: &Infra,
    ) -> Result<RailJson, Box<dyn ApiError>> {
        let railjson = RailJson {
            version: infra.clone().railjson_version,
            operational_points: find_objects(conn, infra.id),
            routes: find_objects(conn, infra.id),
            switch_types: find_objects(conn, infra.id),
            switches: find_objects(conn, infra.id),
            track_section_links: find_objects(conn, infra.id),
            track_sections: find_objects(conn, infra.id),
            speed_sections: find_objects(conn, infra.id),
            catenaries: find_objects(conn, infra.id),
            signals: find_objects(conn, infra.id),
            buffer_stops: find_objects(conn, infra.id),
            detectors: find_objects(conn, infra.id),
        };

        Ok(railjson)
    }
}
