//! Defines [QueryContext] and operations to enrich or exploring it

use std::{collections::HashMap, rc::Rc};

use crate::error::Result;
use editoast_derive::EditoastError;

use super::{
    sqlquery::SqlQuery,
    typing::{AstType, TypeSpec},
};

use thiserror::Error;

/// Represents a [super::searchast::SearchAst] that also carries valid type information
///
/// Functions of the [QueryContext] consume [TypedAst]s  as argument(s) and
/// produce another [TypedAst]. See [QueryContext::def_function].
#[derive(Debug, PartialEq)]
pub enum TypedAst {
    Null,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
    Sequence(Vec<TypedAst>, TypeSpec),
    Column {
        name: String,
        table: Option<String>,
        spec: TypeSpec,
    },
    Sql(Box<SqlQuery>, TypeSpec),
}

impl TypedAst {
    pub fn type_spec(&self) -> TypeSpec {
        match self {
            TypedAst::Null => AstType::Null.into(),
            TypedAst::Boolean(_) => AstType::Boolean.into(),
            TypedAst::Integer(_) => AstType::Integer.into(),
            TypedAst::Float(_) => AstType::Float.into(),
            TypedAst::String(_) => AstType::String.into(),
            TypedAst::Column { spec, .. } | TypedAst::Sql(_, spec) => spec.clone(),
            TypedAst::Sequence(_, item_spec) => TypeSpec::seq(item_spec.clone()),
        }
    }
    pub fn is_ersatz(&self) -> bool {
        matches!(self, TypedAst::Column { .. } | TypedAst::Sql(_, _))
    }
}

impl From<bool> for TypedAst {
    fn from(value: bool) -> Self {
        TypedAst::Boolean(value)
    }
}

impl From<i64> for TypedAst {
    fn from(value: i64) -> Self {
        TypedAst::Integer(value)
    }
}

impl From<f64> for TypedAst {
    fn from(value: f64) -> Self {
        TypedAst::Float(value)
    }
}

impl From<String> for TypedAst {
    fn from(value: String) -> Self {
        TypedAst::String(value)
    }
}

impl<T> From<Option<T>> for TypedAst
where
    T: Into<TypedAst>,
{
    fn from(value: Option<T>) -> Self {
        match value {
            Some(value) => value.into(),
            None => TypedAst::Null,
        }
    }
}

// impl<T: Into<TypedAst>> From<Vec<T>> for TypedAst {
//     fn from(value: Vec<T>) -> Self {
//         Self::Sequence(value.into_iter().map(Into::<Self>::into).collect())
//     }
// }

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "search")]
pub enum ProcessingError {
    #[error("undefined function '{0}'")]
    UndefinedFunction(String),
    #[error("no suitable overload of '{0}' found for {1}")]
    UndefinedOverload(String, String),
    #[error("unexpected column '{0}'")]
    UnexpectedColummn(String),
    #[error("expected type {expected}, got value '{value}' of type {actual} instead")]
    #[editoast_error(no_context)]
    RuntimeTypeCheckFail {
        value: String,
        expected: TypeSpec,
        actual: TypeSpec,
    },
    #[error("expected value of type {expected}, but got ersatz '{value}'")]
    #[editoast_error(no_context)]
    UnexpectedErsatz { value: String, expected: TypeSpec },
}

pub type QueryFunctionFn = Rc<dyn Fn(Vec<TypedAst>) -> Result<TypedAst>>;

/// Represents a context function, with a name and a type signature
pub struct QueryFunction {
    pub signature: TypeSpec,
    pub fun: QueryFunctionFn,
}

/// Defines the environment in which a [super::searchast::SearchAst] is evaluated to produce an
/// SQL expression. See function [QueryContext::evaluate_ast()].
#[derive(Default)]
pub struct QueryContext {
    /// Available functions, with possible overloads. See [Self::def_function()].
    pub functions: HashMap<String, Vec<QueryFunction>>,
    /// The name (or alias) of the table defining the columns used in the query
    pub search_table_name: Option<String>,
    /// Maps a column name to its expected values' type.
    pub columns_type: HashMap<String, TypeSpec>,
}

impl QueryContext {
    /// Adds a function `name` with the given `signature` to the context
    ///
    /// Panics if `signature` is not a [TypeSpec::Function].
    /// See also [Self::def_function_1()], [Self::def_function_2()] for a more convenient
    /// Rust API.
    pub fn def_function<S: AsRef<str>>(
        &mut self,
        name: S,
        signature: TypeSpec,
        fun: QueryFunctionFn,
    ) {
        let TypeSpec::Function { .. } = signature else {
            panic!("signature must be a function signature, got {signature:?}")
        };
        let name: String = name.as_ref().into();
        self.functions
            .entry(name)
            .or_default()
            .push(QueryFunction { signature, fun });
    }

    /// Returns the overload of function `function_name` that typechecks
    /// a list of argument types
    pub fn find_function(
        &self,
        function_name: &String,
        arglist_types: &[TypeSpec],
    ) -> Result<&QueryFunction> {
        let functions = self
            .functions
            .get(function_name)
            .ok_or_else(|| ProcessingError::UndefinedFunction(function_name.to_owned()))?;
        let function = match functions.len() {
            0 => Err(ProcessingError::UndefinedFunction(function_name.to_owned())),
            1 => {
                let function = functions.first().unwrap();
                function
                    .signature
                    .typecheck_args(arglist_types)
                    .map_err(|err| err.with_context("in function", function_name.to_owned()))?;
                Ok(function)
            }
            _ => 'find_overload: {
                for function in functions {
                    if function.signature.typecheck_args(arglist_types).is_ok() {
                        break 'find_overload Ok(function);
                    }
                }
                let pprint = format!(
                    "({0})",
                    arglist_types
                        .iter()
                        .map(|ts| format!("{ts}"))
                        .collect::<Vec<_>>()
                        .join(", ")
                );
                Err(ProcessingError::UndefinedOverload(
                    function_name.to_owned(),
                    pprint,
                ))
            }
        }?;
        Ok(function)
    }

    /// Calls the function `function_name` with `args` and returns its result
    pub fn call<S: AsRef<str>>(&self, function_name: S, args: Vec<TypedAst>) -> Result<TypedAst> {
        let function_name: String = function_name.as_ref().into();
        let values_types = args
            .iter()
            .map(|val| val.type_spec())
            .collect::<Vec<TypeSpec>>();
        let function = self.find_function(&function_name, &values_types)?;
        (function.fun)(args)
            .map_err(|err| err.with_context("in function", function_name.to_owned()))
    }
}
