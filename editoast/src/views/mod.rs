use rocket::Route;

#[get("/health")]
fn health() {}

pub fn routes() -> Vec<Route> {
    routes![health]
}
