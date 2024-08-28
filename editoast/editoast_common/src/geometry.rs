use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

crate::schemas! {
    GeoJson,
    GeoJsonPoint,
    GeoJsonMultiPoint,
    GeoJsonLineString,
    GeoJsonMultiLineString,
    GeoJsonPolygon,
    GeoJsonMultiPolygon,
    GeoJsonPointValue,
    GeoJsonMultiPointValue,
    GeoJsonLineStringValue,
    GeoJsonMultiLineStringValue,
    GeoJsonPolygonValue,
    GeoJsonMultiPolygonValue,
}

// Schema of a GeoJson value meant to be used **exclusively** in the OpenApi
/// A GeoJSON geometry item
#[derive(Serialize, ToSchema)]
#[serde(untagged)]
#[allow(unused)]
pub enum GeoJson {
    Point(GeoJsonPoint),
    MultiPoint(GeoJsonMultiPoint),
    LineString(GeoJsonLineString),
    MultiLineString(GeoJsonMultiLineString),
    Polygon(GeoJsonPolygon),
    MultiPolygon(GeoJsonMultiPolygon),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonPoint {
    Point(GeoJsonPointValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonMultiPoint {
    MultiPoint(GeoJsonMultiPointValue),
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonLineString {
    LineString(GeoJsonLineStringValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonMultiLineString {
    MultiLineString(GeoJsonMultiLineStringValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonPolygon {
    Polygon(GeoJsonPolygonValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
#[allow(unused)]
pub enum GeoJsonMultiPolygon {
    MultiPolygon(GeoJsonMultiPolygonValue),
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
#[allow(unused)]
pub struct GeoJsonPointValue(#[schema(min_items = 2, max_items = 2)] Vec<f64>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct GeoJsonMultiPointValue(#[schema(min_items = 1)] Vec<GeoJsonPointValue>);

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
#[allow(unused)]
pub struct GeoJsonLineStringValue(#[schema(min_items = 2)] Vec<GeoJsonPointValue>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct GeoJsonMultiLineStringValue(#[schema(min_items = 1)] Vec<GeoJsonLineStringValue>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct GeoJsonPolygonValue(#[schema(min_items = 1)] Vec<GeoJsonLineStringValue>);

#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub struct GeoJsonMultiPolygonValue(#[schema(min_items = 1)] Vec<GeoJsonPolygonValue>);
