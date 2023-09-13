use std::{
    fmt::Display,
    ops::{Deref, DerefMut},
};

use rand::{distributions::Alphanumeric, thread_rng, Rng};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use utoipa::ToSchema;

/// A wrapper around a String that ensures that the string is not empty.
#[derive(Debug, Clone, PartialEq, Eq, Hash, ToSchema)]
pub struct NonBlankString(pub String);

impl<'de> Deserialize<'de> for NonBlankString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        if s.is_empty() {
            Err(serde::de::Error::custom("String cannot be left empty"))
        } else {
            Ok(NonBlankString(s))
        }
    }
}

impl Serialize for NonBlankString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.0.as_str())
    }
}

impl Deref for NonBlankString {
    type Target = String;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for NonBlankString {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<String> for NonBlankString {
    fn from(s: String) -> Self {
        s.as_str().into()
    }
}

impl From<&str> for NonBlankString {
    fn from(s: &str) -> Self {
        assert!(!s.is_empty());
        NonBlankString(s.into())
    }
}

impl Default for NonBlankString {
    /// Give a random value of length 10.
    fn default() -> Self {
        NonBlankString(
            (0..10)
                .map(|_| thread_rng().sample(Alphanumeric) as char)
                .collect::<String>(),
        )
    }
}

impl AsRef<str> for NonBlankString {
    fn as_ref(&self) -> &str {
        self.0.as_str()
    }
}

impl Display for NonBlankString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl PartialEq<NonBlankString> for &str {
    fn eq(&self, other: &NonBlankString) -> bool {
        self.eq(&other.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::NonBlankString;

    #[test]
    fn test_de_not_blank_empty() {
        assert!(serde_json::from_str::<NonBlankString>(r#""""#).is_err());
    }

    #[test]
    fn test_de_not_blank_str_valid() {
        let res: NonBlankString = serde_json::from_str(r#""foo""#).unwrap();
        assert_eq!(res.0, "foo");
    }

    #[test]
    fn test_comparison_with_str() {
        let non_blank = NonBlankString("hello".into());
        assert_eq!("hello", non_blank);
        assert_ne!("bye", non_blank);
    }
}
