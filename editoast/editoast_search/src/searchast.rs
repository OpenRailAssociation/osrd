//! Defines [SearchAst]

use std::fmt::Debug;

use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum SearchAstError {
    #[error("could not convert {value} to i64")]
    IntegerConversion { value: u64 },
    #[error("empty arrays are invalid syntax")]
    EmptyArray,
    #[error("invalid column name: '{value}'")]
    InvalidColumnName { value: Value },
    #[error("function identifer must be a string, found '{value}'")]
    InvalidFunctionIdentifier { value: Value },
    #[error("invalid syntax: {value}")]
    InvalidSyntax { value: Value },
}

/// Represents the AST of the query language used in /search route.
///
/// The following JSON schemes are valid [SearchAst]:
///
/// * `null`
/// * Booleans
/// * Integers
/// * Floats
/// * Strings
/// * Arrays
///     * `["column"]`: represents the value of a column (differs from `"column"`
///        which is just a plain string)
///     * `["function", arg1, arg2, ...]`: a function call where `argN` are sub-queries
///
/// Note that the empty array `[]` and all objects `{...}` are invalid queries.
///
/// ```ignore
/// assert!(SearchAst::build_ast(json!(
///     ["and", ["=", ["a"], 12],
///             ["=", ["b"], ["=", true, ["c"]]],
///             ["like", ["d"], "string"]]
/// )).is_ok())
/// ```
#[derive(Debug, PartialEq)]
pub enum SearchAst {
    Null,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
    Column(String),
    Call(String, Vec<SearchAst>),
}

impl SearchAst {
    pub fn build_ast(value: Value) -> Result<SearchAst, SearchAstError> {
        match value {
            Value::Null => Ok(SearchAst::Null),
            Value::Bool(b) => Ok(SearchAst::Boolean(b)),
            Value::Number(n) if n.is_u64() => i64::try_from(n.as_u64().unwrap())
                .map(SearchAst::Integer)
                .map_err(|_| SearchAstError::IntegerConversion {
                    value: n.as_u64().unwrap(),
                }),
            Value::Number(n) if n.is_i64() => Ok(SearchAst::Integer(n.as_i64().unwrap())),
            Value::Number(n) => Ok(SearchAst::Float(n.as_f64().unwrap())),
            Value::String(s) => Ok(SearchAst::String(s)),
            Value::Array(arr) if arr.is_empty() => Err(SearchAstError::EmptyArray),
            Value::Array(mut arr) if arr.len() == 1 => {
                let first = arr.pop().unwrap();
                if first.is_string() && !first.as_str().unwrap().is_empty() {
                    Ok(SearchAst::Column(first.as_str().unwrap().into()))
                } else {
                    Err(SearchAstError::InvalidColumnName { value: first })
                }
            }
            Value::Array(mut arr) => {
                let args = arr.split_off(1);
                let first = arr.pop().unwrap();
                if first.is_string() {
                    let args = args
                        .iter()
                        .map(|val| SearchAst::build_ast(val.clone()))
                        .collect::<Result<Vec<_>, _>>()?;
                    Ok(SearchAst::Call(first.as_str().unwrap().into(), args))
                } else {
                    Err(SearchAstError::InvalidFunctionIdentifier { value: first })
                }
            }
            Value::Object(_) => Err(SearchAstError::InvalidSyntax { value }),
        }
    }
}

#[cfg(test)]
mod tests {

    use serde_json::json;

    use super::*;

    #[test]
    fn from_null() {
        assert_eq!(SearchAst::build_ast(json!(null)).unwrap(), SearchAst::Null);
    }

    #[test]
    fn from_string() {
        assert_eq!(
            SearchAst::build_ast(json!("")).unwrap(),
            SearchAst::String("".to_owned())
        );
        assert_eq!(
            SearchAst::build_ast(json!("hello")).unwrap(),
            SearchAst::String("hello".to_owned())
        );
        assert_eq!(
            SearchAst::build_ast(json!("\"with quotes but not a column\"")).unwrap(),
            SearchAst::String("\"with quotes but not a column\"".to_owned())
        );
    }

    #[test]
    fn from_number() {
        assert_eq!(
            SearchAst::build_ast(json!(42)).unwrap(),
            SearchAst::Integer(42)
        );
        assert_eq!(
            SearchAst::build_ast(json!(-42)).unwrap(),
            SearchAst::Integer(-42)
        );
        assert_eq!(
            SearchAst::build_ast(json!(2.71)).unwrap(),
            SearchAst::Float(2.71)
        );
    }

    #[test]
    fn from_bool() {
        assert_eq!(
            SearchAst::build_ast(json!(true)).unwrap(),
            SearchAst::Boolean(true)
        );
        assert_eq!(
            SearchAst::build_ast(json!(false)).unwrap(),
            SearchAst::Boolean(false)
        );
    }

    #[test]
    fn from_array() {
        assert_eq!(
            SearchAst::build_ast(json!(["column"])).unwrap(),
            SearchAst::Column("column".into())
        );
        assert_eq!(
            SearchAst::build_ast(json!(["complicated column nAm3"])).unwrap(),
            SearchAst::Column("complicated column nAm3".into())
        );
        assert_eq!(
            SearchAst::build_ast(json!(["=", 42, true])).unwrap(),
            SearchAst::Call(
                "=".into(),
                vec![SearchAst::Integer(42), SearchAst::Boolean(true)]
            )
        );
        assert_eq!(
            SearchAst::build_ast(json!(["=", ["+", 44, -2], true])).unwrap(),
            SearchAst::Call(
                "=".into(),
                vec![
                    SearchAst::Call(
                        "+".into(),
                        vec![SearchAst::Integer(44), SearchAst::Integer(-2)]
                    ),
                    SearchAst::Boolean(true)
                ]
            )
        );
    }

    #[test]
    fn from_invalid_json() {
        assert!(SearchAst::build_ast(json!([])).is_err());
        assert!(SearchAst::build_ast(json!([false, 42])).is_err());
        assert!(SearchAst::build_ast(json!([["function"], 42])).is_err());
        assert!(SearchAst::build_ast(json!({})).is_err());
        assert!(SearchAst::build_ast(json!({"a": 12})).is_err());
        assert!(SearchAst::build_ast(json!([""])).is_err()); // invalid column name
    }
}
