use std::fmt::{Debug, Display};

use serde::{Deserialize, Serialize};
use smallvec::SmallVec;

#[derive(Hash, Clone, PartialOrd, Ord, PartialEq, Eq)]
pub struct Key(SmallVec<[u8; 16]>);

impl Serialize for Key {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(&self.encode())
    }
}

impl<'de> Deserialize<'de> for Key {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let key = String::deserialize(deserializer)?;
        Ok(Key::new(&key))
    }
}

impl Display for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.encode())
    }
}

impl From<&[u8]> for Key {
    fn from(e: &[u8]) -> Self {
        Key(e.into())
    }
}

impl Debug for Key {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Key({})", self.encode())
    }
}

impl Key {
    pub fn new(key: &str) -> Self {
        Key(key.as_bytes().into())
    }

    pub(crate) fn encode(&self) -> String {
        self.0.iter().map(|&b| b as char).collect()
    }
}
