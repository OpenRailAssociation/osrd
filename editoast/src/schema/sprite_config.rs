use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;

pub type SpriteConfigs = HashMap<String, SpriteConfig>;

#[derive(Debug, Serialize, Deserialize)]
pub struct SpriteConfig {
    pub default: String,
    #[serde(default)]
    pub sprites: Vec<ConditionalSprite>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConditionalSprite {
    pub conditions: HashMap<String, String>,
    pub sprite: String,
}

impl SpriteConfig {
    /// Get the sprite configuration for all supported signaling systems
    /// Note: This is done statically for now but should be handled by the signaling system plugins
    pub fn load() -> SpriteConfigs {
        let raw_config = include_str!("../../signal_sprites.yml");
        serde_yaml::from_str(raw_config).unwrap()
    }
}
