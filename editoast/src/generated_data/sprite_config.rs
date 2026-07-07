use phf::phf_map;
use serde::Serialize;

pub type SpriteConfigs = phf::Map<&'static str, SpriteConfig>;

#[derive(Debug, Serialize)]
pub struct SpriteConfig {
    pub default: &'static str,
    pub sprites: &'static [ConditionalSprite],
}

#[derive(Debug, Serialize)]
pub struct ConditionalSprite {
    pub conditions: phf::Map<&'static str, &'static str>,
    pub sprite: &'static str,
}

impl SpriteConfig {
    /// Get the sprite configuration for all supported signaling systems
    /// Note: This is done statically for now but should be handled by the signaling system plugins
    pub fn load() -> &'static SpriteConfigs {
        SPRITE_CONFIGS
    }
}

pub const SPRITE_CONFIGS: &SpriteConfigs = &phf_map! {
    "BAL" => BAL,
    "BAPR" => BAPR,
    "TVM300" => TVM300,
    "TVM430" => TVM430,
    "ETCS_LEVEL2" => ETCS_LEVEL2,
};

const BAL: SpriteConfig = SpriteConfig {
    default: "S VL",
    sprites: &[ConditionalSprite {
        conditions: phf_map! {
            "Nf" => "true",
        },
        sprite: "CARRE",
    }],
};

const BAPR: SpriteConfig = SpriteConfig {
    default: "S VL",
    sprites: &[
        ConditionalSprite {
            conditions: phf_map! {
                "Nf" => "true",
                "distant" => "false",
            },
            sprite: "CARRE",
        },
        ConditionalSprite {
            conditions: phf_map! {
                "distant" => "true",
            },
            sprite: "DISQUE VL",
        },
    ],
};

const TVM300: SpriteConfig = SpriteConfig {
    default: "REP TGV",
    sprites: &[],
};

const TVM430: SpriteConfig = SpriteConfig {
    default: "REP TGV",
    sprites: &[],
};

const ETCS_LEVEL2: SpriteConfig = SpriteConfig {
    default: "STOP MARKER",
    sprites: &[],
};
