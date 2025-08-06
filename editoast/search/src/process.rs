//! Query processing workflow

use std::rc::Rc;

use super::context::ProcessingError;
use super::context::QueryContext;
use super::context::TypedAst;
use super::dsl;
use super::searchast::SearchAst;
use super::sqlquery::SqlQuery;
use super::typing::AstType;
use super::typing::TypeSpec;

impl QueryContext {
    /// Typechecks a [SearchAst], returning the type of the whole expressions
    /// if typechecking succeeds
    pub fn typecheck_search_query(
        &self,
        search_ast: &SearchAst,
    ) -> Result<TypeSpec, ProcessingError> {
        let typed_ast = match search_ast {
            SearchAst::Null => AstType::Null.into(),
            SearchAst::Boolean(_) => AstType::Boolean.into(),
            SearchAst::Integer(_) => AstType::Integer.into(),
            SearchAst::Float(_) => AstType::Float.into(),
            SearchAst::String(_) => AstType::String.into(),
            SearchAst::Column(column) => self
                .columns_type
                .get(column)
                .ok_or_else(|| ProcessingError::UnexpectedColumn {
                    column: column.to_owned(),
                })?
                .clone(),
            SearchAst::Call(function_name, args) => {
                let arglist_types = args
                    .iter()
                    .map(|arg| self.typecheck_search_query(arg))
                    .collect::<Result<Vec<_>, _>>()?;
                let function = self.find_function(function_name, &arglist_types)?;
                let TypeSpec::Function { result, .. } = &function.signature else {
                    unreachable!()
                };
                result.as_ref().clone()
            }
        };
        Ok(typed_ast)
    }

    /// Evaluates a [SearchAst] within the context, producing a [TypedAst]
    /// that can later be converted to an [SqlQuery]
    pub fn evaluate_ast(&self, ast: &SearchAst) -> Result<TypedAst, ProcessingError> {
        match ast {
            SearchAst::Null => Ok(TypedAst::Null),
            SearchAst::Boolean(b) => Ok(TypedAst::Boolean(*b)),
            SearchAst::Integer(n) => Ok(TypedAst::Integer(*n)),
            SearchAst::Float(n) => Ok(TypedAst::Float(*n)),
            SearchAst::String(s) => Ok(TypedAst::String(s.clone())),
            SearchAst::Column(name) => Ok(TypedAst::Column {
                name: name.to_owned(),
                table: self.search_table_name.clone(),
                spec: self
                    .columns_type
                    .get(name)
                    .unwrap_or_else(|| panic!("unexpected column {name}"))
                    .to_owned(),
            }),
            SearchAst::Call(function_name, query_args) => {
                let args = query_args
                    .iter()
                    .map(|sub| self.evaluate_ast(sub))
                    .collect::<Result<Vec<_>, _>>()?;
                self.call(function_name, args)
            }
        }
    }

    /// Evaluates a [SearchAst] within the context and returns the generated [SqlQuery]
    ///
    /// See [Self::evaluate_ast()]
    pub fn search_ast_to_sql(&self, ast: &SearchAst) -> Result<SqlQuery, ProcessingError> {
        Ok(self.evaluate_ast(ast)?.into())
    }
}

/// Returns a [QueryContext] populated with functions that map to common
/// SQL operators.
///
/// List of functions:
/// - not : (bool | null) -> (bool | null)
/// - and : variadic (bool | null) -> (bool | null)
/// - or : variadic (bool | null) -> (bool | null)
/// - = : null -> null -> bool
/// - = : (bool | null) -> (bool | null) -> (bool | null)
/// - = : (int | null) -> (int | null) -> (bool | null)
/// - = : (float | null) -> (float | null) -> (bool | null)
/// - = : (string | null) -> (string | null) -> (bool | null)
/// - like : string -> (string | null) -> (bool | null)
/// - ilike : string -> (string | null) -> (bool | null)
/// - search : string -> (string | null) -> bool
/// - =i : string -> string -> bool
/// - to_string : (int | null) -> string
/// - to_string : (float | null) -> string
/// - to_string : (string | null) -> string
/// - list : variadic string -> string list
/// - contains : string list -> string list -> bool
pub fn create_processing_context() -> QueryContext {
    let mut context = QueryContext::default();
    context.def_function_1::<dsl::Nullable<dsl::Ersatz<dsl::Boolean>>, dsl::Sql<dsl::Boolean>>(
        "not",
        Rc::new(|x| Ok(SqlQuery::prefix("NOT", x))),
    );
    context.def_function(
        "and",
        TypeSpec::varg(TypeSpec::or(AstType::Null, AstType::Boolean)) >> AstType::Boolean,
        Rc::new(|args| Ok(SqlQuery::join("AND", args).into_typed_ast(AstType::Boolean.into()))),
    );
    context.def_function(
        "or",
        TypeSpec::varg(TypeSpec::or(AstType::Null, AstType::Boolean)) >> AstType::Boolean,
        Rc::new(|args| Ok(SqlQuery::join("OR", args).into_typed_ast(AstType::Boolean.into()))),
    );
    let eq = Rc::new(|left: Option<TypedAst>, right: Option<TypedAst>| {
        Ok(SqlQuery::infix("=", left, right))
    });
    context
        .def_function_2::<dsl::Nullable<dsl::Ersatz<dsl::Null>>, dsl::Nullable<dsl::Ersatz<dsl::Null>>, dsl::Sql<dsl::Boolean>>(
            "=",
            eq.clone(),
        );
    context.def_function_2::<dsl::Nullable<dsl::Ersatz<dsl::Boolean>>, dsl::Nullable<dsl::Ersatz<dsl::Boolean>>, dsl::Sql<dsl::Boolean>>(
            "=",
            eq.clone(),
        );
    context.def_function_2::<dsl::Nullable<dsl::Ersatz<dsl::Integer>>, dsl::Nullable<dsl::Ersatz<dsl::Integer>>, dsl::Sql<dsl::Boolean>>(
            "=",
            eq.clone(),
        );
    context
        .def_function_2::<dsl::Nullable<dsl::Ersatz<dsl::Float>>, dsl::Nullable<dsl::Ersatz<dsl::Float>>, dsl::Sql<dsl::Boolean>>(
            "=",
            eq.clone(),
        );
    context.def_function_2::<dsl::Nullable<dsl::Ersatz<dsl::String>>, dsl::Nullable<dsl::Ersatz<dsl::String>>, dsl::Sql<dsl::Boolean>>(
            "=", eq,
        );
    context.def_function_2::<dsl::Ersatz<dsl::String>, dsl::Nullable<dsl::String>, dsl::Sql<dsl::Nullable<dsl::Boolean>>>(
            "like",
            Rc::new(|string, pattern| {
                Ok(SqlQuery::infix(
                    "LIKE",
                    string,
                    pattern.into()
                ))
            }),
        );
    context.def_function_2::<dsl::Ersatz<dsl::String>, dsl::Nullable<dsl::String>, dsl::Sql<dsl::Nullable<dsl::Boolean>>>(
            "ilike",
            Rc::new(|string, pattern| {
                Ok(SqlQuery::infix(
                    "ILIKE",
                    string,
                    pattern.into()
                ))
            }),
        );
    context.def_function_2::<dsl::Ersatz<dsl::String>, dsl::Nullable<dsl::String>, dsl::Sql<dsl::Boolean>>(
        "search",
        Rc::new(|value, pattern| {
            Ok(match pattern {
                Some(pattern) => SqlQuery::infix(
                    "ILIKE",
                    value.into(),
                    SqlQuery::call("osrd_to_ilike_search", vec![pattern]),
                ),
                None => SqlQuery::Value(TypedAst::Boolean(false)),
            })
        }),
    );
    context.def_function_2::<dsl::Ersatz<dsl::String>, dsl::Nullable<dsl::String>, dsl::Sql<dsl::Boolean>>(
        "=i",
        Rc::new(|left, right| {
            Ok(SqlQuery::infix("ILIKE", left, right.into()))
        })
    );
    let to_string = Rc::new(|value: Option<TypedAst>| {
        Ok(SqlQuery::cast(
            value.unwrap_or(TypedAst::String(Default::default())),
            "TEXT",
        ))
    });
    context.def_function_1::<dsl::Nullable<dsl::Ersatz<dsl::String>>, dsl::Sql<dsl::String>>(
        "to_string",
        to_string.clone(),
    );
    context.def_function_1::<dsl::Nullable<dsl::Ersatz<dsl::Integer>>, dsl::Sql<dsl::String>>(
        "to_string",
        to_string.clone(),
    );
    context.def_function_1::<dsl::Nullable<dsl::Ersatz<dsl::Float>>, dsl::Sql<dsl::String>>(
        "to_string",
        to_string.clone(),
    );
    context.def_function(
        "list",
        TypeSpec::varg(AstType::String) >> TypeSpec::seq(AstType::String),
        Rc::new(|args| Ok(TypedAst::Sequence(args, AstType::String.into()))),
    );
    context.def_function_2::<dsl::Ersatz<dsl::Array<dsl::String>>, dsl::Ersatz<dsl::Array<dsl::String>>, dsl::Sql<dsl::Boolean>>(
        "contains",
        Rc::new(|sub, array| Ok(SqlQuery::infix("<@", sub, array))),
    );
    context
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use serde_json::json;
    use serde_json::Value;

    use super::*;

    fn test_env() -> QueryContext {
        let mut env = create_processing_context();
        env.columns_type
            .insert("name".into(), AstType::String.into());
        env.columns_type
            .insert("trigram".into(), AstType::String.into());
        env.columns_type
            .insert("infra_id".into(), AstType::Integer.into());
        // + : int -> int -> int
        env.def_function_2::<dsl::Integer, dsl::Integer, dsl::Integer>(
            "+",
            Rc::new(|a, b| Ok(a + b)),
        );
        env
    }

    fn typecheck(query: Value) -> Result<TypeSpec, ProcessingError> {
        let expr = SearchAst::build_ast(query).unwrap();
        let env = test_env();
        env.typecheck_search_query(&expr)
    }

    fn try_eval(query: Value) -> Result<TypedAst, ProcessingError> {
        let expr = SearchAst::build_ast(query).unwrap();
        let env = test_env();
        env.evaluate_ast(&expr)
    }

    fn eval(query: Value) -> TypedAst {
        try_eval(query).unwrap()
    }

    #[test]
    fn test_typecheck() {
        assert!(typecheck(json!(null)).is_ok());
        assert!(typecheck(json!(true)).is_ok());
        assert!(typecheck(json!(12)).is_ok());
        assert!(typecheck(json!(3.15)).is_ok());
        assert!(typecheck(json!("hello")).is_ok());
        assert!(typecheck(json!(["name"])).is_ok());
        assert!(typecheck(json!(["=", ["name"], "hello"])).is_ok());
        assert!(typecheck(json!(["and", true, false, ["=", ["name"], ["trigram"]]])).is_ok());
    }

    #[test]
    fn test_typecheck_error() {
        assert!(try_eval(json!(["+", 21, "21"])).is_err());
        assert!(try_eval(json!(["not", 0])).is_err());
        assert!(try_eval(json!(["=", 0, 0, 0])).is_err());
        assert!(try_eval(json!(["like", null, null])).is_err());
        assert!(try_eval(json!(["like", "test", ["name"]])).is_err());
        assert!(try_eval(json!(["and", true, false, true, "true"])).is_err());
    }

    #[test]
    fn test_typecheck_undeclared_column() {
        assert!(typecheck(json!(["like", "test", ["; DROP DATABASE ohno"]])).is_err())
    }

    #[test]
    fn eval_literal() {
        assert_eq!(eval(json!(null)), TypedAst::Null);
        assert_eq!(eval(json!(42)), TypedAst::Integer(42));
        assert_eq!(eval(json!(-2.71)), TypedAst::Float(-2.71));
        assert_eq!(
            eval(json!("hello, world")),
            TypedAst::String("hello, world".to_owned())
        );
        assert_eq!(eval(json!("COLUMN")), TypedAst::String("COLUMN".to_owned())); // just a string
        assert_eq!(
            eval(json!("\"COLUMN\"")),
            TypedAst::String("\"COLUMN\"".to_owned())
        ); // likewise
        assert_eq!(eval(json!(true)), TypedAst::Boolean(true));
        assert_eq!(
            eval(json!(["name"])),
            TypedAst::Column {
                name: "name".into(),
                table: None,
                spec: AstType::String.into(),
            }
        );
        assert_eq!(
            eval(json!(["infra_id"])),
            TypedAst::Column {
                name: "infra_id".into(),
                table: None,
                spec: AstType::Integer.into(),
            }
        );
    }

    #[test]
    fn eval_call() {
        assert_eq!(
            eval(json!(["not", false])),
            TypedAst::Sql(
                Box::new(SqlQuery::prefix("NOT", TypedAst::Boolean(false),)),
                AstType::Boolean.into()
            )
        );
        assert_eq!(
            eval(json!(["like", ["name"], "patrick"])),
            TypedAst::Sql(
                Box::new(SqlQuery::infix(
                    "LIKE",
                    TypedAst::Column {
                        name: "name".into(),
                        table: None,
                        spec: AstType::String.into(),
                    },
                    TypedAst::String("patrick".to_owned()),
                )),
                TypeSpec::or(AstType::Boolean, AstType::Null)
            )
        );
        // + is a pure rust function
        assert_eq!(eval(json!(["+", 22, 20])), TypedAst::Integer(42));
    }

    #[test]
    fn test_call_dispatch() {
        assert_eq!(
            eval(json!(["=", 42, 42])),
            TypedAst::Sql(
                Box::new(SqlQuery::infix(
                    "=",
                    TypedAst::Integer(42),
                    TypedAst::Integer(42),
                )),
                AstType::Boolean.into()
            )
        );
        assert_eq!(
            eval(json!(["=", true, false])),
            TypedAst::Sql(
                Box::new(SqlQuery::infix(
                    "=",
                    TypedAst::Boolean(true),
                    TypedAst::Boolean(false),
                )),
                AstType::Boolean.into()
            )
        );
        assert!(try_eval(json!(["=", 42, false])).is_err());
    }

    #[test]
    fn test_call_variadic() {
        assert_eq!(
            eval(json!(["and", true])),
            TypedAst::Sql(
                Box::new(SqlQuery::InfixOp {
                    operator: "AND".into(),
                    operands: vec![TypedAst::Boolean(true).into(),]
                }),
                AstType::Boolean.into()
            )
        );
        assert_eq!(
            eval(json!(["and", true, true, false])),
            TypedAst::Sql(
                Box::new(SqlQuery::InfixOp {
                    operator: "AND".into(),
                    operands: vec![
                        TypedAst::Boolean(true).into(),
                        TypedAst::Boolean(true).into(),
                        TypedAst::Boolean(false).into(),
                    ]
                }),
                AstType::Boolean.into()
            )
        );
    }

    #[test]
    fn test_eval_real() {
        let req = json!([
            "and",
            [
                "or",
                ["search", ["name"], "denis"],
                ["search", ["trigram"], null]
            ],
            ["=", ["infra_id"], 2]
        ]);
        let expected = TypedAst::Sql(
            Box::new(SqlQuery::infix(
                "AND",
                SqlQuery::infix(
                    "OR",
                    SqlQuery::InfixOp {
                        operator: "ILIKE".to_owned(),
                        operands: vec![
                            SqlQuery::Value(TypedAst::Column {
                                name: "name".to_owned(),
                                table: None,
                                spec: AstType::String.into(),
                            }),
                            SqlQuery::Call {
                                function: "osrd_to_ilike_search".to_owned(),
                                args: vec![SqlQuery::Value(TypedAst::String("denis".to_owned()))],
                            },
                        ],
                    },
                    SqlQuery::Value(TypedAst::Boolean(false)),
                ),
                SqlQuery::infix(
                    "=",
                    TypedAst::Column {
                        name: "infra_id".into(),
                        table: None,
                        spec: AstType::Integer.into(),
                    },
                    TypedAst::Integer(2),
                ),
            )),
            AstType::Boolean.into(),
        );
        assert_eq!(eval(req), expected);
    }

    #[test]
    fn test_null_keeping() {
        assert_eq!(
            eval(json!(["=", null, null])),
            TypedAst::Sql(
                Box::new(SqlQuery::InfixOp {
                    operator: "=".to_string(),
                    operands: vec![TypedAst::Null.into(), TypedAst::Null.into()]
                }),
                AstType::Boolean.into()
            )
        );
    }

    #[test]
    fn test_arity_error() {
        assert!(try_eval(json!(["+", 21])).is_err());
        assert!(try_eval(json!(["+", 21, 10, 11])).is_err());
        assert!(try_eval(json!(["not", true, false])).is_err());
        assert!(try_eval(json!(["like", "test"])).is_err());
        assert!(try_eval(json!(["like", "test", null, null])).is_err());
    }
}
