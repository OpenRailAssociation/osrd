use geos::geojson::{self, Geometry};
use postgis_diesel::types::{LineString, Point};
use serde_derive::Serialize;
use utoipa::ToSchema;

use crate::schemas;

schemas! {
    GeometryValue,
    PointValue,
    MultiPointValue,
    LineStringValue,
    MultiLineStringValue,
    PolygonValue,
    MultiPolygonValue,
}

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

// Schema of a geometry value meant made exclusively for utoipa annotations
/// A GeoJSON geometry item
#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeometryValue {
    Point(PointValue),
    MultiPoint(MultiPointValue),
    LineString(LineStringValue),
    MultiLineString(MultiLineStringValue),
    Polygon(PolygonValue),
    MultiPolygon(MultiPolygonValue),
}

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct PointValue(Vec<f64>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct MultiPointValue(Vec<PointValue>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct LineStringValue(Vec<Vec<f64>>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct MultiLineStringValue(Vec<LineStringValue>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct PolygonValue(Vec<Vec<Vec<f64>>>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct MultiPolygonValue(Vec<PolygonValue>);
