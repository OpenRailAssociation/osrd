use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
    /// The stretch of the vertical tangent polygon this range is
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_alignment: Option<VerticalAlignment>,
}

/// A stretch of the vertical alignment's tangent polygon, from `begin` to `end` of its slope
///
/// OSRD does not interpret it: the slope's `gradient` stays what the simulation uses.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct VerticalAlignment {
    /// The tangent polygon's point at `begin`
    pub begin: HeightPoint,
    /// The tangent polygon's point at `end`
    pub end: HeightPoint,
    /// EPSG code of the vertical datum the elevations are stated in
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub epsg: Option<u32>,
}

/// A point of the vertical tangent polygon
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct HeightPoint {
    /// Elevation of the top of the rail that is not raised by the cant, in meters
    pub elevation: f64,
    /// Radius in meters of the vertical curve rounding the change of gradient at this point
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_curve_radius: Option<f64>,
    /// Length in meters of that vertical curve, where the length governs it rather than the radius
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vertical_curve_length: Option<f64>,
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;
    use serde_json::json;
    use serde_json::to_value;

    use super::Slope;

    #[test]
    fn slope_without_vertical_alignment_is_unchanged() {
        let slope = from_str::<Slope>(r#"{"gradient": 4.5, "begin": 0, "end": 100}"#).unwrap();
        assert!(slope.vertical_alignment.is_none());
        assert_eq!(
            to_value(&slope).unwrap(),
            json!({"gradient": 4.5, "begin": 0.0, "end": 100.0})
        );
    }

    #[test]
    fn slope_with_vertical_alignment() {
        let slope = from_str::<Slope>(
            r#"{
                "gradient": -8.17, "begin": 0, "end": 37.171,
                "vertical_alignment": {
                    "begin": {"elevation": 318.5939},
                    "end": {"elevation": 318.2901, "vertical_curve_radius": 5000},
                    "epsg": 7837
                }
            }"#,
        )
        .unwrap();
        let alignment = slope.vertical_alignment.unwrap();
        assert_eq!(alignment.begin.elevation, 318.5939);
        assert_eq!(alignment.begin.vertical_curve_radius, None);
        assert_eq!(alignment.end.vertical_curve_radius, Some(5000.));
        assert_eq!(alignment.epsg, Some(7837));
    }
}
