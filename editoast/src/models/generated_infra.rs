use crate::schema::osrd_infra_generatedinfra;
use crate::schema::osrd_infra_generatedinfra::dsl::*;
use diesel::prelude::*;
use diesel::{PgConnection, QueryDsl, RunQueryDsl};
use rocket::serde::Serialize;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_generatedinfra"]
pub struct GeneratedInfra {
    infra_id: i32,
    pub version: i64,
}

impl GeneratedInfra {
    pub fn retrieve(conn: &PgConnection, id: i32) -> Self {
        match osrd_infra_generatedinfra.find(id).first(conn) {
            // Return retrieved infra
            Ok(gen_infra) => gen_infra,
            // Create a default one
            Err(diesel::result::Error::NotFound) => diesel::insert_into(osrd_infra_generatedinfra)
                .values((infra_id.eq(id), version.eq(0)))
                .get_result(conn)
                .unwrap(),
            // Something went wrong
            Err(e) => panic!("{}", e),
        }
    }

    pub fn save(&self, conn: &PgConnection) {
        diesel::update(osrd_infra_generatedinfra.filter(infra_id.eq(self.infra_id)))
            .set(version.eq(self.version))
            .execute(conn)
            .expect("Save generated infra failed");
    }
}
