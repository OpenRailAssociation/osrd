use figment::{
    providers::{Env, Format, Serialized, Toml},
    Figment,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
pub struct Target {
    pub prefix: String,
    pub upstream: String,
    pub remove_prefix: Option<bool>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ProxyConfig {
    pub listen_addr: String,
    pub port: u16,
    pub static_folder: Option<String>,
    pub default_target: Option<String>,
    pub targets: Vec<Target>,
}

impl Default for ProxyConfig {
    fn default() -> ProxyConfig {
        ProxyConfig {
            listen_addr: "127.0.0.1".to_string(),
            port: 8080,
            static_folder: None,
            default_target: None,
            targets: vec![],
        }
    }
}

impl ProxyConfig {
    fn validate_and_process(&mut self) -> Result<ProxyConfig, String> {
        if self.static_folder.is_none() && self.default_target.is_none() {
            return Err("No static folder nor default target set".to_string());
        }
        Ok(self.clone())
    }
}

pub fn load() -> Result<ProxyConfig, figment::Error> {
    let mut config: ProxyConfig = Figment::from(Serialized::defaults(ProxyConfig::default()))
        .merge(Toml::file("gateway.toml"))
        .merge(Env::prefixed("OSRD_GW_"))
        .extract()?;

    config
        .validate_and_process()
        .map_err(|e| figment::Error::from(e))
}
