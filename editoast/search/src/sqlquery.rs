//! Defines [SqlQuery]

use std::fmt::Display;

use super::context::TypedAst;
use super::typing::AstType;
use super::typing::TypeSpec;

/// A small wrapper around SQL expression syntax that is more convenient
/// and reliable to use (as opposed to multiple string interpolations)
///
/// Also takes care of parenthesizing and providing the strings to interpolate.
#[derive(Debug, PartialEq)]
pub enum SqlQuery {
    Value(TypedAst),
    Call {
        function: String,
        args: Vec<SqlQuery>,
    },
    PrefixOp {
        operator: String,
        operand: Box<SqlQuery>,
    },
    InfixOp {
        operator: String,
        operands: Vec<SqlQuery>,
    },
    Cast {
        operand: Box<SqlQuery>,
        ty: String,
    },
}

impl<T> From<T> for SqlQuery
where
    T: Into<TypedAst>,
{
    fn from(value: T) -> Self {
        let ast: TypedAst = value.into();
        if let TypedAst::Sql(expr, _) = ast {
            *expr
        } else {
            SqlQuery::Value(ast)
        }
    }
}

impl SqlQuery {
    /// Constructor for [Self::PrefixOp]
    pub fn prefix<S: AsRef<str>, V: Into<SqlQuery>>(operator: S, operand: V) -> SqlQuery {
        let operand = operand.into();
        Self::PrefixOp {
            operator: operator.as_ref().into(),
            operand: Box::new(operand),
        }
    }

    /// Constructor for [Self::InfixOp] with two operands
    pub fn infix<S: AsRef<str>, V: Into<SqlQuery>>(operator: S, left: V, right: V) -> SqlQuery {
        Self::join(operator, vec![left, right])
    }

    /// Constructor for [Self::InfixOp]
    pub fn join<S: AsRef<str>, V: Into<SqlQuery>>(operator: S, operands: Vec<V>) -> SqlQuery {
        let operands: Vec<SqlQuery> = operands.into_iter().map(|val| val.into()).collect();
        Self::InfixOp {
            operator: operator.as_ref().into(),
            operands,
        }
    }

    /// Constructor for [Self::Call]
    pub fn call<S: AsRef<str>, V: Into<SqlQuery>>(function: S, args: Vec<V>) -> SqlQuery {
        Self::Call {
            function: function.as_ref().into(),
            args: args
                .into_iter()
                .map(|val| val.into())
                .collect::<Vec<SqlQuery>>(),
        }
    }

    pub fn cast<S: AsRef<str>, V: Into<SqlQuery>>(operand: V, ty: S) -> SqlQuery {
        Self::Cast {
            operand: Box::new(operand.into()),
            ty: ty.as_ref().into(),
        }
    }

    pub fn into_typed_ast(self, spec: TypeSpec) -> TypedAst {
        TypedAst::Sql(Box::new(self), spec)
    }

    /// Builds the SQL code represented by self
    pub fn to_sql(&self, string_bindings: &mut Vec<String>) -> String {
        match self {
            SqlQuery::Value(value) => value_to_sql(value, string_bindings),
            SqlQuery::Call { function, args } => {
                format!(
                    "{function}({0})",
                    args.iter()
                        .map(|arg| format!("({0})", arg.to_sql(string_bindings)))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
            SqlQuery::PrefixOp { operator, operand } => format!("{operator} ({operand})"),
            SqlQuery::InfixOp { operator, operands } => operands
                .iter()
                .map(|op| format!("({0})", op.to_sql(string_bindings)))
                .collect::<Vec<_>>()
                .join(&format!(" {operator} ")),
            SqlQuery::Cast { operand, ty } => {
                format!("({0})::{ty}", operand.to_sql(string_bindings),)
            }
        }
    }
}

impl Display for SqlQuery {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let sql = self.to_sql(&mut Default::default());
        write!(f, "{sql}")
    }
}

fn sql_type(spec: &TypeSpec) -> Option<String> {
    match spec {
        TypeSpec::Type(AstType::Boolean) => Some("BOOLEAN".to_owned()),
        TypeSpec::Type(AstType::Integer) => Some("INTEGER".to_owned()),
        TypeSpec::Type(AstType::Float) => Some("NUMERIC".to_owned()),
        TypeSpec::Type(AstType::String) => Some("TEXT".to_owned()),
        _ => None,
    }
}

fn value_to_sql(value: &TypedAst, string_bindings: &mut Vec<String>) -> String {
    match value {
        TypedAst::Null => "NULL".to_owned(),
        TypedAst::Boolean(true) => "TRUE".to_owned(),
        TypedAst::Boolean(false) => "FALSE".to_owned(),
        TypedAst::Integer(i) => i.to_string(),
        TypedAst::Float(n) => format!("{n:?}"), // HACK: keeps .0 if n is an integer, otherwise displays all decimals
        TypedAst::String(string) => {
            string_bindings.push(string.clone());
            format!("${0}", string_bindings.len())
        }
        TypedAst::Column {
            name: column,
            table: None,
            ..
        } => format!("\"{column}\""),
        TypedAst::Column {
            name: column,
            table: Some(table),
            ..
        } => format!("\"{table}\".\"{column}\""),
        TypedAst::Sql(expr, _) => expr.to_string(),
        TypedAst::Sequence(items, item_type) => {
            let cast = sql_type(item_type).expect("could not convert into sql type");
            let items = items
                .iter()
                .map(|val| format!("({0})", value_to_sql(val, string_bindings)))
                .collect::<Vec<_>>()
                .join(",");
            format!("ARRAY[{items}]::{cast}[]")
        }
    }
}

#[cfg(test)]
mod tests {

    use super::SqlQuery;
    use crate::context::TypedAst;
    use crate::typing::AstType;

    #[test]
    fn render_literal() {
        assert_eq!(&SqlQuery::Value(TypedAst::Null).to_string(), "NULL");
        assert_eq!(
            &SqlQuery::Value(TypedAst::Boolean(true)).to_string(),
            "TRUE"
        );
        assert_eq!(
            &SqlQuery::Value(TypedAst::Boolean(false)).to_string(),
            "FALSE"
        );
        assert_eq!(&SqlQuery::Value(TypedAst::Integer(42)).to_string(), "42");
        assert_eq!(&SqlQuery::Value(TypedAst::Integer(-42)).to_string(), "-42");
        assert_eq!(&SqlQuery::Value(TypedAst::Float(0.1)).to_string(), "0.1");
        assert_eq!(&SqlQuery::Value(TypedAst::Float(0.0)).to_string(), "0.0");
        assert_eq!(
            &SqlQuery::Value(TypedAst::Float(-42.314)).to_string(),
            "-42.314"
        );
        assert_eq!(
            &SqlQuery::Value(TypedAst::String("hello".to_owned())).to_string(),
            "$1"
        );
        let mut binds = Default::default();
        assert_eq!(
            &SqlQuery::Value(TypedAst::String("hello".to_owned())).to_sql(&mut binds),
            "$1"
        );
        assert_eq!(&binds, &["hello".to_owned()]);
        assert_eq!(
            &SqlQuery::Value(TypedAst::Column {
                name: "column".to_owned(),
                table: None,
                spec: AstType::Null.into()
            })
            .to_string(),
            "\"column\""
        );
    }

    #[test]
    fn render_call() {
        assert_eq!(
            &SqlQuery::call(
                "lower",
                vec![SqlQuery::Value(TypedAst::String(String::new()))]
            )
            .to_string(),
            "lower(($1))"
        );
        assert_eq!(
            &SqlQuery::call(
                "plus",
                vec![
                    SqlQuery::Value(TypedAst::Integer(22)),
                    SqlQuery::Value(TypedAst::Integer(20))
                ]
            )
            .to_string(),
            "plus((22), (20))"
        );
        assert_eq!(
            &SqlQuery::call(
                "any",
                vec![
                    SqlQuery::Value(TypedAst::Boolean(true)),
                    SqlQuery::Value(TypedAst::Boolean(false)),
                    SqlQuery::Value(TypedAst::Boolean(true)),
                    SqlQuery::Value(TypedAst::Boolean(false)),
                    SqlQuery::Value(TypedAst::Boolean(true)),
                    SqlQuery::Value(TypedAst::Boolean(false)),
                ]
            )
            .to_string(),
            "any((TRUE), (FALSE), (TRUE), (FALSE), (TRUE), (FALSE))"
        );
    }

    #[test]
    fn render_prefix_op() {
        assert_eq!(
            &SqlQuery::prefix("NOT", TypedAst::Boolean(false)).to_string(),
            "NOT (FALSE)"
        );
        assert_eq!(
            &SqlQuery::prefix("NOT", SqlQuery::prefix("NOT", TypedAst::Boolean(false))).to_string(),
            "NOT (NOT (FALSE))"
        );
        assert_eq!(
            &SqlQuery::prefix("NOT", SqlQuery::prefix("NOT", TypedAst::Null)).to_string(),
            "NOT (NOT (NULL))"
        );
    }

    #[test]
    fn render_infix_op() {
        assert_eq!(
            &SqlQuery::join(
                "AND",
                vec![
                    TypedAst::Boolean(true),
                    TypedAst::Boolean(false),
                    TypedAst::Boolean(true)
                ],
            )
            .to_string(),
            "(TRUE) AND (FALSE) AND (TRUE)"
        );
        assert_eq!(
            &SqlQuery::join("AND", vec![TypedAst::Boolean(true)]).to_string(),
            "(TRUE)"
        );
        assert_eq!(
            &SqlQuery::join(
                "AND",
                vec![
                    TypedAst::Boolean(true),
                    TypedAst::Null,
                    TypedAst::Boolean(false)
                ],
            )
            .to_string(),
            "(TRUE) AND (NULL) AND (FALSE)"
        );
        assert_eq!(
            &SqlQuery::join("AND", vec![TypedAst::Boolean(true), TypedAst::Null],).to_string(),
            "(TRUE) AND (NULL)"
        );
    }

    #[test]
    fn render_arrays() {
        assert_eq!(
            &SqlQuery::Value(TypedAst::Sequence(
                vec![TypedAst::Integer(1)],
                AstType::Integer.into()
            ))
            .to_string(),
            "ARRAY[(1)]::INTEGER[]"
        );
        assert_eq!(
            &SqlQuery::Value(TypedAst::Sequence(
                vec![TypedAst::Integer(1), TypedAst::Integer(2)],
                AstType::Integer.into()
            ))
            .to_string(),
            "ARRAY[(1),(2)]::INTEGER[]"
        );
        assert_eq!(
            &SqlQuery::Value(TypedAst::Sequence(vec![], AstType::Integer.into())).to_string(),
            "ARRAY[]::INTEGER[]"
        );
    }
}
