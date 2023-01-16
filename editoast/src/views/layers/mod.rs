mod info;

use info::info_route;
use rocket::{routes, Route};

pub fn routes() -> Vec<Route> {
    routes![info_route]
}
