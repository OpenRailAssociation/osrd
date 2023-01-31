use serde::{de::Error, Deserialize, Deserializer};
use std::str::FromStr;

/// This parameter is used to deserialized a list of `T`
#[derive(Debug, Default, Clone)]
pub struct List<T>(pub Vec<T>);

impl<'de, T> Deserialize<'de> for List<T>
where
    T: FromStr,
    <T as std::str::FromStr>::Err: std::fmt::Display,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let mut res = vec![];
        if !s.is_empty() {
            for element in s.split(',') {
                let element = element.parse().map_err(Error::custom)?;
                res.push(element);
            }
        }
        Ok(List(res))
    }
}
