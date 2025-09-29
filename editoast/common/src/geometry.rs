use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSON_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJson as utoipa::ToSchema>::name(),
        <GeoJson as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONPOINT_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonPoint as utoipa::ToSchema>::name(),
        <GeoJsonPoint as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTIPOINT_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiPoint as utoipa::ToSchema>::name(),
        <GeoJsonMultiPoint as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONLINESTRING_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonLineString as utoipa::ToSchema>::name(),
        <GeoJsonLineString as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTILINESTRING_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiLineString as utoipa::ToSchema>::name(),
        <GeoJsonMultiLineString as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONPOLYGON_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonPolygon as utoipa::ToSchema>::name(),
        <GeoJsonPolygon as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTIPOLYGON_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiPolygon as utoipa::ToSchema>::name(),
        <GeoJsonMultiPolygon as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONPOINTVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonPointValue as utoipa::ToSchema>::name(),
        <GeoJsonPointValue as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTIPOINTVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiPointValue as utoipa::ToSchema>::name(),
        <GeoJsonMultiPointValue as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONLINESTRINGVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonLineStringValue as utoipa::ToSchema>::name(),
        <GeoJsonLineStringValue as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTILINESTRINGVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiLineStringValue as utoipa::ToSchema>::name(),
        <GeoJsonMultiLineStringValue as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONPOLYGONVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonPolygonValue as utoipa::ToSchema>::name(),
        <GeoJsonPolygonValue as utoipa::PartialSchema>::schema(),
    )
};
#[linkme::distributed_slice(crate::OPENAPI_SCHEMAS)]
static _GEOJSONMULTIPOLYGONVALUE_SLICE_ITEM: crate::OpenApiSchemaSliceItem = || {
    (
        <GeoJsonMultiPolygonValue as utoipa::ToSchema>::name(),
        <GeoJsonMultiPolygonValue as utoipa::PartialSchema>::schema(),
    )
};

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
