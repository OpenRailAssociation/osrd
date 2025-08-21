use std::fmt::{Debug, Display};

use serde::{Deserialize, Serialize};
use smol_str::SmolStr;

#[derive(Hash, Clone, PartialOrd, Ord, PartialEq, Eq)]
pub struct Key(SmolStr);

impl Serialize for Key {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Key {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let key = SmolStr::deserialize(deserializer)?;
        Ok(Key::new(&key))
    }
}

impl Display for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.encode())
    }
}

impl TryFrom<&[u8]> for Key {
    type Error = std::str::Utf8Error;

    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let key_str = str::from_utf8(value)?;
        Ok(Key::new(key_str))
    }
}

impl Debug for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Key({})", self.encode())
    }
}

impl Key {
    pub fn new(key: &str) -> Self {
        Key(SmolStr::new(key))
    }

    pub(crate) fn encode(&self) -> &str {
        &self.0
    }
}
