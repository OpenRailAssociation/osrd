#![expect(unused)] // None of these types are supposed to be used directly: use geos::geojson instead.

use utoipa::ToSchema;

/// A GeoJSON geometry item
#[derive(ToSchema)]
pub struct GeoJson(#[schema(inline)] serde_remotes::GeoJson);
#[derive(ToSchema)]
pub struct GeoJsonPoint(#[schema(inline)] serde_remotes::GeoJsonPoint);
#[derive(ToSchema)]
pub struct GeoJsonMultiPoint(#[schema(inline)] serde_remotes::GeoJsonMultiPoint);
#[derive(ToSchema)]
pub struct GeoJsonLineString(#[schema(inline)] serde_remotes::GeoJsonLineString);
#[derive(ToSchema)]
pub struct GeoJsonMultiLineString(#[schema(inline)] serde_remotes::GeoJsonMultiLineString);
#[derive(ToSchema)]
pub struct GeoJsonPolygon(#[schema(inline)] serde_remotes::GeoJsonPolygon);
#[derive(ToSchema)]
pub struct GeoJsonMultiPolygon(#[schema(inline)] serde_remotes::GeoJsonMultiPolygon);
#[derive(ToSchema)]
pub struct GeoJsonPointValue(#[schema(inline)] serde_remotes::GeoJsonPointValue);
#[derive(ToSchema)]
pub struct GeoJsonMultiPointValue(#[schema(inline)] serde_remotes::GeoJsonMultiPointValue);
#[derive(ToSchema)]
pub struct GeoJsonLineStringValue(#[schema(inline)] serde_remotes::GeoJsonLineStringValue);
#[derive(ToSchema)]
pub struct GeoJsonMultiLineStringValue(
    #[schema(inline)] serde_remotes::GeoJsonMultiLineStringValue,
);
#[derive(ToSchema)]
pub struct GeoJsonPolygonValue(#[schema(inline)] serde_remotes::GeoJsonPolygonValue);
#[derive(ToSchema)]
pub struct GeoJsonMultiPolygonValue(#[schema(inline)] serde_remotes::GeoJsonMultiPolygonValue);

/// Defines serializable versions of GeoJson types only meant to be used as remote
/// definitions for the public schemas defined above.
///
/// NONE OF THESE TYPES ARE SUPPOSED TO BE USED AT ALL!
///
/// The reason we do things this way is because ToSchema reads serde annotations to
/// configure the schema. Here 'untagged' and 'type/content'. So we derive Serialize
/// on these private types, so that we can have the right schema, and then use those
/// in public types to provide the schema. It prevents the public types from being
/// Serialize or Deserialize, so that they can only be used within ToSchema.
mod serde_remotes {
    use serde::Serialize;
    use utoipa::ToSchema;

    #[derive(Serialize, ToSchema)]
    #[serde(untagged)]
    pub(super) enum GeoJson {
        Point(GeoJsonPoint),
        MultiPoint(GeoJsonMultiPoint),
        LineString(GeoJsonLineString),
        MultiLineString(GeoJsonMultiLineString),
        Polygon(GeoJsonPolygon),
        MultiPolygon(GeoJsonMultiPolygon),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonPoint {
        Point(GeoJsonPointValue),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonMultiPoint {
        MultiPoint(GeoJsonMultiPointValue),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonLineString {
        LineString(GeoJsonLineStringValue),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonMultiLineString {
        MultiLineString(GeoJsonMultiLineStringValue),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonPolygon {
        Polygon(GeoJsonPolygonValue),
    }

    #[derive(Serialize, ToSchema)]
    #[serde(tag = "type", content = "coordinates")]
    pub(super) enum GeoJsonMultiPolygon {
        MultiPolygon(GeoJsonMultiPolygonValue),
    }

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonPointValue(Vec<f64>);

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonMultiPointValue(Vec<GeoJsonPointValue>);

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonLineStringValue(Vec<GeoJsonPointValue>);

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonMultiLineStringValue(Vec<GeoJsonLineStringValue>);

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonPolygonValue(Vec<GeoJsonLineStringValue>);

    #[derive(Serialize, ToSchema)]
    pub(super) struct GeoJsonMultiPolygonValue(Vec<GeoJsonPolygonValue>);
}
