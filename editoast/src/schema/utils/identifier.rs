use std::{
    fmt::Display,
    ops::{Deref, DerefMut},
};

use rand::{distributions::Alphanumeric, thread_rng, Rng};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use utoipa::ToSchema;

use crate::schemas;

schemas! {
    Identifier,
}

/// A wrapper around a String that ensures that the string is not empty and not longer than 255 characters.
#[derive(Debug, Clone, PartialEq, Eq, Hash, ToSchema)]
pub struct Identifier(pub String);

impl<'de> Deserialize<'de> for Identifier {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        if s.is_empty() {
            Err(serde::de::Error::custom("Identifier cannot be empty"))
        } else if s.len() > 255 {
            Err(serde::de::Error::custom(
                "Identifier cannot be longer than 255 characters",
            ))
        } else {
            Ok(Identifier(s))
        }
    }
}

impl Serialize for Identifier {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.0.as_str())
    }
}

impl Deref for Identifier {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Identifier {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<String> for Identifier {
    fn from(s: String) -> Self {
        s.as_str().into()
    }
}

impl From<&str> for Identifier {
    fn from(s: &str) -> Self {
        assert!((1..256).contains(&s.len()));
        Identifier(s.into())
    }
}

impl Default for Identifier {
    /// Give a random value of length 10.
    fn default() -> Self {
        Identifier(
            (0..10)
                .map(|_| thread_rng().sample(Alphanumeric) as char)
                .collect::<String>(),
        )
    }
}

impl AsRef<str> for Identifier {
    fn as_ref(&self) -> &str {
        self.0.as_str()
    }
}

impl Display for Identifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::Identifier;

    #[test]
    fn test_de_identifier_valid() {
        let res: Identifier = serde_json::from_str(r#""foo""#).unwrap();
        assert_eq!(res, "foo".into());
    }

    #[test]
    fn test_de_identifier_empty() {
        assert!(serde_json::from_str::<Identifier>(r#""""#).is_err());
    }

    #[test]
    fn test_de_identifier_too_long() {
        let id = "a".repeat(256);
        assert!(serde_json::from_str::<Identifier>(format!(r#""{id}""#).as_str()).is_err());
    }
}
