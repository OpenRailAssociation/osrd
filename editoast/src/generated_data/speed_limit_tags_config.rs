use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::ops::Deref;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitTagIds(pub Vec<String>);

type SpeedLimitTagsConfig = HashMap<String, SpeedLimitTag>;

#[derive(Debug, Serialize, Deserialize)]
struct SpeedLimitTag {
    #[serde(default)]
    pub fallback_list: Vec<String>,
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

impl Deref for SpeedLimitTagIds {
    type Target = Vec<String>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
