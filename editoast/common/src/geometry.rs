use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

// Schema of a GeoJson value meant to be used **exclusively** in the OpenApi
/// A GeoJSON geometry item
#[derive(Serialize, ToSchema)]
#[serde(untagged)]
pub enum GeoJson {
    Point(GeoJsonPoint),
    MultiPoint(GeoJsonMultiPoint),
    LineString(GeoJsonLineString),
    MultiLineString(GeoJsonMultiLineString),
    Polygon(GeoJsonPolygon),
    MultiPolygon(GeoJsonMultiPolygon),
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonPoint {
    Point(GeoJsonPointValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonMultiPoint {
    MultiPoint(GeoJsonMultiPointValue),
}

#[derive(Serialize, Deserialize, PartialEq, ToSchema, Debug, Clone)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonLineString {
    LineString(GeoJsonLineStringValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonMultiLineString {
    MultiLineString(GeoJsonMultiLineStringValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonPolygon {
    Polygon(GeoJsonPolygonValue),
}

#[derive(Serialize, ToSchema)]
#[serde(tag = "type", content = "coordinates")]
pub enum GeoJsonMultiPolygon {
    MultiPolygon(GeoJsonMultiPolygonValue),
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
pub struct GeoJsonPointValue(pub Vec<f64>);

#[derive(Serialize, ToSchema)]
pub struct GeoJsonMultiPointValue(Vec<GeoJsonPointValue>);

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
pub struct GeoJsonLineStringValue(pub Vec<GeoJsonPointValue>);

#[derive(Serialize, ToSchema)]
pub struct GeoJsonMultiLineStringValue(Vec<GeoJsonLineStringValue>);

#[derive(Serialize, ToSchema)]
pub struct GeoJsonPolygonValue(Vec<GeoJsonLineStringValue>);

#[derive(Serialize, ToSchema)]
pub struct GeoJsonMultiPolygonValue(Vec<GeoJsonPolygonValue>);
