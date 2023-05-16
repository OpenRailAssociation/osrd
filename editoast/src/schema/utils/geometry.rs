use geos::geojson::{self, Geometry};
use postgis_diesel::types::{LineString, Point};

pub fn geojson_to_diesel_linestring(geo: &Geometry) -> LineString<Point> {
    match &geo.value {
        geojson::Value::LineString(ls) => LineString {
            points: ls
                .iter()
                .map(|p| {
                    let [x, y] = p.as_slice() else { panic!("no") };
                    Point::new(*x, *y, None)
                })
                .collect(),
            srid: None,
        },
        _ => panic!("not implemented"),
    }
}

pub fn diesel_linestring_to_geojson(ls: LineString<Point>) -> Geometry {
    Geometry::new(geojson::Value::LineString(
        ls.points.into_iter().map(|p| vec![p.x, p.y]).collect(),
    ))
}
