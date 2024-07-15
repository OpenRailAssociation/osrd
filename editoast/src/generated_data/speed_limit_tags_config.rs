use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitTagIds(Vec<String>);

type SpeedLimitTagsConfig = HashMap<String, SpeedLimitTag>;

#[derive(Debug, Serialize, Deserialize)]
struct SpeedLimitTag {
    pub name: String,
    #[serde(default)]
    pub fallback_list: Vec<String>,
    pub default_speed: f64,
}

impl SpeedLimitTagIds {
    /// Get the speed-limit tag ids list
    pub fn load() -> SpeedLimitTagIds {
        let raw_config = include_str!("../../../assets/static_resources/speed_limit_tags.yml");
        SpeedLimitTagIds(
            serde_yaml::from_str::<SpeedLimitTagsConfig>(raw_config)
                .unwrap()
                .keys()
                .cloned()
                .collect(),
        )
    }
}
