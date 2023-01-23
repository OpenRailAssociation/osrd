mod info;
mod layer;
mod mvt_utils;
use info::info_route;
use layer::{cache_and_get_mvt_tile, layer_view};
use rocket::{routes, Route};

pub fn routes() -> Vec<Route> {
    routes![info_route, layer_view, cache_and_get_mvt_tile]
}
