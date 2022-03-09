use crate::schema::osrd_infra_infra::dsl::*;
use diesel::prelude::*;
use diesel::result::Error;
use diesel::update;
use diesel::{PgConnection, QueryDsl, RunQueryDsl};
use rocket::serde::Serialize;

#[derive(Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
pub struct Infra {
    pub id: i32,
    pub name: String,
}

impl Infra {
    pub fn retrieve(infra_id: i32, conn: &PgConnection) -> Result<Infra, Error> {
        osrd_infra_infra.filter(id.eq(infra_id)).first(conn)
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
