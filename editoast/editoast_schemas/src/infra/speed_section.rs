use std::collections::HashMap;

use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

use super::ApplicableDirectionsTrackRange;
use super::Sign;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Derivative, Clone, Serialize, PartialEq, Copy)]
pub struct Speed(pub f64);

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct SpeedSection {
    pub id: Identifier,
    #[derivative(Default(value = "Some(Speed(80.))"))]
    pub speed_limit: Option<Speed>,
    pub speed_limit_by_tag: HashMap<NonBlankString, Speed>,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_routes: Option<Vec<Identifier>>,
    #[serde(default)]
    pub extensions: SpeedSectionExtensions,
}

impl<'de> Deserialize<'de> for Speed {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = f64::deserialize(deserializer)?;

        if value <= 0.0 {
            return Err(serde::de::Error::custom(
                "expected speed to be greater than 0",
            ));
        }

        Ok(Speed(value))
    }
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionExtensions {
    pub psl_sncf: Option<SpeedSectionPslSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SpeedSectionPslSncfExtension {
    announcement: Vec<Sign>,
    z: Sign,
    r: Vec<Sign>,
}

impl SpeedSectionPslSncfExtension {
    pub fn announcement(&self) -> &Vec<Sign> {
        &self.announcement
    }

    pub fn z(&self) -> &Sign {
        &self.z
    }

    pub fn r(&self) -> &Vec<Sign> {
        &self.r
    }
}

impl OSRDTyped for SpeedSection {
    fn get_type() -> ObjectType {
        ObjectType::SpeedSection
    }
}

impl OSRDIdentified for SpeedSection {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[cfg(test)]
mod test {
    use serde_json::from_str;
    use serde_json::from_value;
    use serde_json::json;

    use super::SpeedSection;
    use super::SpeedSectionExtensions;

    #[test]
    fn test_speed_section_extensions_deserialization() {
        from_str::<SpeedSectionExtensions>(r#"{}"#).unwrap();
    }

    // SpeedSection validation succeed
    #[test]
    fn test_valid_speed_section() {
        let section = json!({
            "id": "section_id",
            "speed_limit": 50.0,
            "speed_limit_by_tag": {},
            "track_ranges": [],
        });
        assert!(from_value::<SpeedSection>(section).is_ok());
    }

    // SpeedSection validation failed caused by speed_limit
    #[test]
    fn test_invalid_speed_limit() {
        let section = json!({
            "id": "section_id",
            "speed_limit": -10.0,
            "speed_limit_by_tag": {},
            "track_ranges": [],
        });
        assert!(from_value::<SpeedSection>(section).is_err());
    }

    // SpeedSection validation failed caused by speed_limit_by_tag
    #[test]
    fn test_invalid_speed_limit_by_tag() {
        let section = json!({
            "id": "section_id",
            "speed_limit": 50.0,
            "speed_limit_by_tag": {"tag": 0},
            "track_ranges": [],
        });
        assert!(from_value::<SpeedSection>(section).is_err());
    }
}
