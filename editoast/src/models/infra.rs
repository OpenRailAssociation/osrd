use crate::schema::osrd_infra_infra;
use crate::schema::osrd_infra_infra::dsl::*;
use diesel::prelude::*;
use diesel::{sql_query, update, PgConnection, QueryDsl, RunQueryDsl};
use rocket::serde::Serialize;
use std::error::Error;
use std::fmt;

static _RAILJSON_VERSION: &'static str = "2.2.0";

#[derive(Clone, QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_infra"]
pub struct Infra {
    pub id: i32,
    pub name: String,
    pub version: i64,
}

#[derive(Debug)]
pub enum InfraError {
    /// Couldn't found the infra with the given id
    NotFound(i32),
    Other(diesel::result::Error),
}

impl fmt::Display for InfraError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InfraError::NotFound(infra_id) => write!(f, "Infra '{}' could not be found.", infra_id),
            InfraError::Other(diesel_error) => write!(f, "{}", diesel_error),
        }
    }
}

impl Error for InfraError {}

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

    pub fn retrieve(conn: &PgConnection, infra_id: i32) -> Result<Infra, InfraError> {
        match osrd_infra_infra.find(infra_id).first(conn) {
            Ok(infra) => Ok(infra),
            Err(diesel::result::Error::NotFound) => Err(InfraError::NotFound(infra_id)),
            Err(e) => Err(InfraError::Other(e)),
        }
    }

    pub fn list(conn: &PgConnection) -> Result<Vec<Infra>, diesel::result::Error> {
        osrd_infra_infra.load::<Self>(conn)
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

    pub fn bump_version(&self, conn: &PgConnection) -> Self {
        diesel::update(osrd_infra_infra.filter(id.eq(self.id)))
            .set(version.eq(self.version + 1))
            .get_result(conn)
            .expect("Bump infra version failed")
    }

    pub fn _create(infra_name: &String, conn: &PgConnection) -> Infra {
        sql_query(format!(
            "INSERT INTO osrd_infra_infra (name, railjson_version, owner, version)
             VALUES ('{}', '{}', '00000000-0000-0000-0000-000000000000', 1)
             RETURNING *",
            infra_name, _RAILJSON_VERSION
        ))
        .get_result::<Infra>(conn)
        .expect("Fail to create an Infra")
        .clone()
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
            let infra = Infra::_create(&"test".to_string(), &conn);
            assert_eq!("test", infra.name);
            Ok(())
        });
    }
}
