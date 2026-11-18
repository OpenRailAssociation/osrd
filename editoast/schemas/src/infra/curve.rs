use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct Curve {
    pub radius: f64,
    pub begin: f64,
    pub end: f64,
    /// The design element of the horizontal alignment this range is
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub horizontal_alignment: Option<HorizontalAlignment>,
}

/// A design element of the horizontal alignment, from `begin` to `end` of its curve
///
/// OSRD does not interpret it: the curve's `radius` stays what the simulation uses.
/// Radii and cants are signed: a positive radius turns right in the direction of increasing
/// offsets, a positive cant raises the left rail.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct HorizontalAlignment {
    pub element_type: HorizontalElementType,
    /// The shape of a transition's curvature, only for a transition
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transition_type: Option<TransitionType>,
    /// Radius of an arc in meters
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radius: Option<f64>,
    /// Radius of a transition at `begin` in meters, absent where it joins a straight
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub begin_radius: Option<f64>,
    /// Radius of a transition at `end` in meters, absent where it joins a straight
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_radius: Option<f64>,
    /// Cant in millimeters where it is the same at both ends, instead of `begin_cant` and `end_cant`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cant: Option<f64>,
    /// Cant at `begin` in millimeters where the cant changes along the element
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub begin_cant: Option<f64>,
    /// Cant at `end` in millimeters where the cant changes along the element
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_cant: Option<f64>,
    /// Easting and northing of `begin` in meters, in the plane given by `epsg`
    pub begin_point: [f64; 2],
    /// Easting and northing of `end` in meters, in the plane given by `epsg`
    pub end_point: [f64; 2],
    /// EPSG code of the plane `begin_point` and `end_point` are stated in
    pub epsg: u32,
    /// Bearing at `begin` in degrees from grid north, clockwise
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bearing: Option<f64>,
    /// Bearing at `end` in degrees, only where it differs from the one the element's shape gives
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_bearing: Option<f64>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HorizontalElementType {
    Straight,
    Arc,
    Transition,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum TransitionType {
    Clothoid,
    Bloss,
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;
    use serde_json::json;
    use serde_json::to_value;

    use super::Curve;
    use super::HorizontalElementType;
    use super::TransitionType;

    #[test]
    fn curve_without_horizontal_alignment_is_unchanged() {
        let curve = from_str::<Curve>(r#"{"radius": 500, "begin": 0, "end": 100}"#).unwrap();
        assert!(curve.horizontal_alignment.is_none());
        assert_eq!(
            to_value(&curve).unwrap(),
            json!({"radius": 500.0, "begin": 0.0, "end": 100.0})
        );
    }

    #[test]
    fn curve_with_a_transition() {
        let curve = from_str::<Curve>(
            r#"{
                "radius": 424.29877, "begin": 0, "end": 28.2112531,
                "horizontal_alignment": {
                    "element_type": "transition", "transition_type": "clothoid",
                    "begin_radius": 424.29877,
                    "begin_cant": 47.019, "end_cant": 0,
                    "begin_point": [3459173.8365845, 5643874.6483156],
                    "end_point": [3459200.36523, 5643884.24142],
                    "epsg": 5683, "bearing": 68.849494213
                }
            }"#,
        )
        .unwrap();
        let alignment = curve.horizontal_alignment.unwrap();
        assert_eq!(alignment.element_type, HorizontalElementType::Transition);
        assert_eq!(alignment.transition_type, Some(TransitionType::Clothoid));
        assert_eq!(alignment.begin_radius, Some(424.29877));
        assert_eq!(alignment.end_radius, None);
        assert_eq!(alignment.end_point, [3459200.36523, 5643884.24142]);
    }
}
