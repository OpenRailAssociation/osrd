use crate::response::ApiError;
use crate::schema::osrd_infra_infra;
use crate::schema::osrd_infra_infra::dsl::*;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel::{delete, sql_query, update, PgConnection, QueryDsl, RunQueryDsl};
use rocket::serde::{Deserialize, Serialize};
use thiserror::Error;

static RAILJSON_VERSION: &'static str = "2.2.0";

#[derive(Clone, QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_infra"]
pub struct Infra {
    pub id: i32,
    pub name: String,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct CreateInfra {
    pub name: String,
}

#[derive(Debug, Error)]
pub enum InfraError {
    /// Couldn't found the infra with the given id
    #[error("Infra '{0}', could not be found")]
    NotFound(i32),
    #[error("An internal diesel error occurred: '{}'", .0.to_string())]
    Other(DieselError),
}

impl ApiError for InfraError {
    fn get_code(&self) -> u16 {
        match self {
            InfraError::NotFound(_) => 404,
            InfraError::Other(_) => 500,
        }
    }

    fn get_type(&self) -> &'static str {
        match self {
            InfraError::NotFound(_) => "editoast:infra:NotFound",
            InfraError::Other(_) => "editoast:infra:Other",
        }
    }
}

impl Infra {
    pub fn _retrieve_list(
        conn: &PgConnection,
        ids: &Vec<i32>,
    ) -> Result<Vec<Infra>, diesel::result::Error> {
        println!("{:?}", vec![3, 4]);
        let ids: Vec<String> = ids.iter().map(|i| i.to_string()).collect();
        sql_query(format!(
            "SELECT id, name FROM osrd_infra_infra WHERE id IN ({})",
            ids.join(",")
        ))
        .load(conn)
    }

    pub fn retrieve(conn: &PgConnection, infra_id: i32) -> Result<Infra, Box<dyn ApiError>> {
        match osrd_infra_infra.find(infra_id).first(conn) {
            Ok(infra) => Ok(infra),
            Err(DieselError::NotFound) => Err(Box::new(InfraError::NotFound(infra_id))),
            Err(e) => Err(Box::new(InfraError::Other(e))),
        }
    }

    pub fn list(conn: &PgConnection) -> Vec<Infra> {
        osrd_infra_infra
            .load::<Self>(conn)
            .expect("List infra query failed")
    }

    pub fn _rename(
        &mut self,
        new_name: String,
        conn: &PgConnection,
    ) -> Result<(), diesel::result::Error> {
        let new_infra = update(osrd_infra_infra.find(self.id))
            .set(name.eq(new_name))
            .get_result::<Self>(conn)?;
        self.name = new_infra.name;
        Ok(())
    }

    pub fn bump_version(&self, conn: &PgConnection) -> Result<Self, Box<dyn ApiError>> {
        match update(osrd_infra_infra.filter(id.eq(self.id)))
            .set(version.eq(self.version + 1))
            .get_result::<Infra>(conn)
        {
            Ok(infra) => Ok(infra),
            Err(DieselError::NotFound) => Err(Box::new(InfraError::NotFound(self.id))),
            Err(err) => Err(Box::new(InfraError::Other(err))),
        }
    }

    pub fn create(infra_name: &String, conn: &PgConnection) -> Result<Infra, Box<dyn ApiError>> {
        match sql_query(format!(
            "INSERT INTO osrd_infra_infra (name, railjson_version, owner, version)
             VALUES ('{}', '{}', '00000000-0000-0000-0000-000000000000', 1)
             RETURNING *",
            infra_name, RAILJSON_VERSION
        ))
        .get_result::<Infra>(conn)
        {
            Ok(infra) => Ok(infra),
            Err(err) => Err(Box::new(InfraError::Other(err))),
        }
    }

    pub fn delete(infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
        match delete(osrd_infra_infra.filter(id.eq(infra_id))).execute(conn) {
            Ok(1) => Ok(()),
            Ok(_) => Err(Box::new(InfraError::NotFound(infra_id))),
            Err(err) => Err(Box::new(InfraError::Other(err))),
        }
    }
}

#[cfg(test)]
mod test {
    use super::Infra;
    use crate::client::PostgresConfig;
    use diesel::result::Error;
    use diesel::{Connection, PgConnection};

    #[test]
    fn create_infra() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert_eq!("test", infra.name);
            Ok(())
        });
    }

    #[test]
    fn delete_infra() {
        let conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|| {
            let infra = Infra::create(&"test".to_string(), &conn).unwrap();
            assert!(Infra::delete(infra.id, &conn).is_ok());
            let err = Infra::delete(infra.id, &conn).unwrap_err();
            assert_eq!(err.get_code(), 404);
            Ok(())
        });
    }
}
