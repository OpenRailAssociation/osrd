use std::fmt::{Debug, Display};

use percent_encoding::{percent_decode_str, percent_encode, NON_ALPHANUMERIC};
use serde::Serialize;
use smallvec::SmallVec;

#[derive(Hash, Clone, PartialOrd, Ord, PartialEq, Eq)]
pub struct Key(SmallVec<[u8; 16]>);

impl Serialize for Key {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(&self.encode())
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
        f.write_str("Key(")?;
        for chunk in self.encode_iter() {
            f.write_str(chunk)?;
        }
        f.write_str(")")
    }
}

impl Key {
    pub fn new(key: &str) -> Self {
        Key(key.as_bytes().into())
    }

    pub(crate) fn decode(encoded_key: &str) -> Self {
        Key(percent_decode_str(encoded_key).collect())
    }

    pub(crate) fn encode_iter(&self) -> impl Iterator<Item = &str> {
        percent_encode(&self.0, NON_ALPHANUMERIC)
    }

    pub(crate) fn encode(&self) -> String {
        self.encode_iter().collect()
    }
}
