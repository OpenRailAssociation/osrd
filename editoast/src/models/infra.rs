use crate::schema::osrd_infra_infra;
use crate::schema::osrd_infra_infra::dsl::*;
use diesel::prelude::*;
use diesel::result::Error;
use diesel::{sql_query, update, PgConnection, QueryDsl, RunQueryDsl};
use rocket::serde::Serialize;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_infra"]
pub struct Infra {
    pub id: i32,
    pub name: String,
}

impl Infra {
    pub fn retrieve_list(conn: &PgConnection, ids: &Vec<i32>) -> Result<Vec<Infra>, Error> {
        let ids: Vec<String> = ids.iter().map(|i| i.to_string()).collect();
        sql_query(format!(
            "SELECT id, name FROM osrd_infra_infra WHERE id IN ({})",
            ids.join(",")
        ))
        .load(conn)
    }

    pub fn retrieve(conn: &PgConnection, infra_id: i32) -> Result<Infra, Error> {
        osrd_infra_infra.find(infra_id).first(conn)
    }

    pub fn list(conn: &PgConnection) -> Result<Vec<Infra>, Error> {
        osrd_infra_infra.load::<Self>(conn)
    }

    pub fn rename(&mut self, new_name: String, conn: &PgConnection) -> Result<(), Error> {
        let new_infra = update(osrd_infra_infra.find(self.id))
            .set(name.eq(new_name))
            .get_result::<Self>(conn)?;
        self.name = new_infra.name;
        Ok(())
    }
}
