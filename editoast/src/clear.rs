use crate::api_error::ApiError;

use crate::infra::Infra;

use crate::layer::Layer;

use crate::schema::{
    BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
    TrackSection, TrackSectionLink,
};

use diesel::PgConnection;

/// Clear all generated data for the given infra.
pub fn clear(conn: &PgConnection, infra: &Infra) -> Result<(), Box<dyn ApiError>> {
    TrackSection::clear(conn, infra.id)?;
    Signal::clear(conn, infra.id)?;
    SpeedSection::clear(conn, infra.id)?;
    TrackSectionLink::clear(conn, infra.id)?;
    Switch::clear(conn, infra.id)?;
    Detector::clear(conn, infra.id)?;
    BufferStop::clear(conn, infra.id)?;
    Route::clear(conn, infra.id)?;
    OperationalPoint::clear(conn, infra.id)?;
    Catenary::clear(conn, infra.id)?;

    infra.downgrade_generated_version(conn)?;

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use crate::clear::clear;
    use crate::client::PostgresConfig;
    use crate::infra::Infra;
    use crate::layer::Layer;
    use crate::schema::{
        BufferStop, Catenary, Detector, OperationalPoint, Route, Signal, SpeedSection, Switch,
        TrackSection, TrackSectionLink,
    };
    use diesel::{Connection, PgConnection};
    use rocket::http::Status;
    #[test]
    fn clear_test() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        let infra = Infra::create("test", &conn).unwrap();
        assert_eq!(TrackSection::clear(&conn, infra.id), Ok(()));
        assert_eq!(Switch::clear(&conn, infra.id), Ok(()));
        assert_eq!(Detector::clear(&conn, infra.id), Ok(()));
        assert_eq!(BufferStop::clear(&conn, infra.id), Ok(()));
        assert_eq!(Route::clear(&conn, infra.id), Ok(()));
        assert_eq!(OperationalPoint::clear(&conn, infra.id), Ok(()));
        assert_eq!(Catenary::clear(&conn, infra.id), Ok(()));
        assert_eq!(SpeedSection::clear(&conn, infra.id), Ok(()));
        assert_eq!(Signal::clear(&conn, infra.id), Ok(()));
        assert_eq!(TrackSectionLink::clear(&conn, infra.id), Ok(()));
    }

    #[test]
    fn clear_rs() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        let infra = Infra::create("test", &conn).unwrap();
        assert!(Infra::delete(infra.id, &conn).is_ok());
        let err = clear(&conn, &infra).unwrap_err();
        assert_eq!(err.get_status(), Status::NotFound);
    }
}
