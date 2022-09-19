use rocket_contrib::databases::diesel;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
