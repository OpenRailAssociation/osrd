//! Defines the deserializers for the `search.yml` config file

use std::collections::HashMap;

use serde::{de::Visitor, Deserialize};

use super::typing::{AstType, TypeSpec};

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct Config {
    #[serde(flatten)]
    pub entries: HashMap<String, SearchEntry>,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchEntry {
    pub table: String,
    pub columns: HashMap<String, TypeSpec>,
    pub result: SearchResult,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchResult {
    pub joins: Option<String>,
    pub columns: HashMap<String, String>,
}

struct TsVisitor;

impl<'de> Visitor<'de> for TsVisitor {
    type Value = TypeSpec;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("a type descriptor (e.g.: integer, string array, ...)")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: serde::de::SeqAccess<'de>,
    {
        use serde::de::Error as E;
        let Some(operator) = seq.next_element::<String>()? else {
            return Err(E::custom("expected a string at type spec array at position 0"))
        };
        let specs = {
            let mut specs: Vec<Self::Value> = Vec::new();
            while let Some(spec) = seq.next_element()? {
                specs.push(spec);
            }
            specs
        };
        match operator.to_lowercase().as_str() {
            "array" => match specs.len() {
                0 => Err(E::custom(
                    "'array' type spec found but no item type spec provided",
                )),
                1 => Ok(TypeSpec::seq(specs[0].clone())),
                _ => Err(E::custom(
                    "'array' type specifier takes exactly one argument",
                )),
            },
            "or" => match specs.len() {
                0 => Err(E::custom(
                    "'or' type spec found but no alternatives type specs provided",
                )),
                _ => Ok(TypeSpec::union_from_iter(specs.into_iter()).unwrap()),
            },
            op => Err(E::custom(format!("unknown type spec '{op}'"))),
        }
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        match value.to_lowercase().as_str() {
            "null" => Ok(AstType::Null),
            "bool" | "boolean" => Ok(AstType::Boolean),
            "int" | "integer" => Ok(AstType::Integer),
            "float" | "double" => Ok(AstType::Float),
            "str" | "string" | "text" => Ok(AstType::String),
            x => Err(E::custom(format!("'{x}' does not describe any type"))),
        }
        .map(Into::into)
    }
}

impl<'de> Deserialize<'de> for TypeSpec {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserializer.deserialize_any(TsVisitor)
    }
}

impl Config {
    pub fn parse() -> Config {
        serde_yaml::from_str(include_str!("../../../search.yml"))
            .expect("Invalid search.yml config file:")
    }
}

#[cfg(test)]
mod test {
    use crate::views::search::typing::{AstType, TypeSpec};

    fn parse(s: &str) -> Result<TypeSpec, serde_yaml::Error> {
        serde_yaml::from_str(s)
    }

    #[test]
    fn test_parse_type_spec() {
        assert_eq!(parse("integer").unwrap(), AstType::Integer.into());
        assert_eq!(parse("int").unwrap(), AstType::Integer.into());
        assert_eq!(parse("string").unwrap(), AstType::String.into());
        assert_eq!(
            parse("['array', 'string']").unwrap(),
            TypeSpec::seq(AstType::String)
        );
        assert_eq!(
            parse("['array', ['array', 'bool']]").unwrap(),
            TypeSpec::seq(TypeSpec::seq(AstType::Boolean))
        );
        assert_eq!(
            parse("['or', 'float', 'null']").unwrap(),
            TypeSpec::or(AstType::Float, AstType::Null)
        );
        assert_eq!(parse("['or', 'float']").unwrap(), AstType::Float.into());
        assert_eq!(
            parse("['or', 'float', 'null', 'string']").unwrap(),
            TypeSpec::union_from_iter(
                [AstType::Float, AstType::Null, AstType::String]
                    .into_iter()
                    .map(Into::<TypeSpec>::into)
            )
            .unwrap()
        );
        assert_eq!(
            parse("['or', ['or', 'int', 'float'], 'null']").unwrap(),
            TypeSpec::or(
                TypeSpec::or(AstType::Integer, AstType::Float),
                AstType::Null
            )
        );
        assert_eq!(
            parse("['or', ['array', ['or', 'int', 'float']], 'null']").unwrap(),
            TypeSpec::or(
                TypeSpec::seq(TypeSpec::or(AstType::Integer, AstType::Float)),
                AstType::Null
            )
        );
    }

    #[test]
    fn test_parse_type_spec_error() {
        assert!(parse("nope").is_err());
        assert!(parse("123").is_err());
        assert!(parse("null").is_err());
        assert!(parse("'null'").is_ok()); // !
        assert!(parse("['array']").is_err());
        assert!(parse("['array', 'int', 'float']").is_err());
        assert!(parse("['or']").is_err());
    }
}
