//! Defines [SqlQuery]

use std::{collections::VecDeque, fmt::Display};

use super::{context::TypedAst, typing::TypeSpec};

/// A small wrapper around SQL expression syntax that is more convenient
/// and reliable to use (as opposed to multiple string interpolations)
///
/// Also takes care of parenthesizing and providing the strings to interpolate.
/// See [SqlQuery::unsafe_strings()].
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

    pub fn into_typed_ast(self, spec: TypeSpec) -> TypedAst {
        TypedAst::Sql(Box::new(self), spec)
    }

    /// Builds the SQL code represented by self
    pub fn to_sql(&self, bind_pos: &mut u64) -> String {
        match self {
            SqlQuery::Value(TypedAst::String(_)) => {
                *bind_pos += 1;
                format!("${0}", *bind_pos - 1)
            }
            SqlQuery::Value(value) => value_to_sql(value),
            SqlQuery::Call { function, args } => {
                format!(
                    "{function}({0})",
                    args.iter()
                        .map(|arg| format!("({0})", arg.to_sql(bind_pos)))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
            SqlQuery::PrefixOp { operator, operand } => format!("{operator} ({operand})"),
            SqlQuery::InfixOp { operator, operands } => operands
                .iter()
                .map(|op| format!("({0})", op.to_sql(bind_pos)))
                .collect::<Vec<_>>()
                .join(&format!(" {operator} ")),
        }
    }
}

impl Display for SqlQuery {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut n = 1;
        let sql = self.to_sql(&mut n);
        write!(f, "{sql}")
    }
}

fn value_to_sql(value: &TypedAst) -> String {
    match value {
        TypedAst::Null => "NULL".to_owned(),
        TypedAst::Boolean(true) => "TRUE".to_owned(),
        TypedAst::Boolean(false) => "FALSE".to_owned(),
        TypedAst::Integer(i) => i.to_string(),
        TypedAst::Float(n) => format!("{n:?}"), // HACK: keeps .0 if n is an integer, otherwise displays all decimals
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
        TypedAst::String(_) => unreachable!(),
    }
}

impl SqlQuery {
    /// Returns an iterator that iterates through all strings to interpolate in
    /// the SQL Query
    pub fn unsafe_strings(&self) -> UnsafeStrings {
        UnsafeStrings {
            stack: VecDeque::from([self]),
        }
    }
}

/// See [SqlQuery::unsafe_strings()]
pub struct UnsafeStrings<'a> {
    stack: VecDeque<&'a SqlQuery>,
}

impl<'a> Iterator for UnsafeStrings<'a> {
    type Item = &'a String;

    fn next(&mut self) -> Option<Self::Item> {
        let sql = self.stack.pop_front()?;
        match sql {
            SqlQuery::Value(TypedAst::String(string)) => Some(string),
            SqlQuery::Call {
                args: sub_expressions,
                ..
            }
            | SqlQuery::InfixOp {
                operands: sub_expressions,
                ..
            } => {
                self.stack.extend(sub_expressions.iter());
                self.next()
            }
            SqlQuery::PrefixOp { operand, .. } => {
                self.stack.push_back(operand);
                self.next()
            }
            _ => self.next(),
        }
    }
}

#[cfg(test)]
mod test {
    use crate::views::search::{context::TypedAst, typing::AstType};

    use super::SqlQuery;

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
        let mut n = 42;
        assert_eq!(
            &SqlQuery::Value(TypedAst::String("hello".to_owned())).to_sql(&mut n),
            "$42"
        );
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
}
