//! Defines the trait [Type] and the functions [QueryContext::def_function_1()]
//! and [QueryContext::def_function_2()] that allows inserting new functions
//! into the context more easily
use std::marker::PhantomData;
use std::rc::Rc;

use super::context::ProcessingError;
use super::context::QueryContext;
use super::typing::TypeSpec;
use super::AstType;
use super::TypedAst;
use crate::sqlquery::SqlQuery;

/// Trait that should be implemented by all DSL specifiers types to provide
/// the required compile-time information to the [QueryContext::def_function_1()]-like
/// functions
///
/// # The problem
///
/// [QueryContext] defines an environment function as a function that consumes
/// a `Vec<TypedAst>` to produce a single `TypedAst` (cf. [super::context::QueryFunctionFn]).
/// Albeit easy to use by the implementation of [QueryContext], that definition makes
/// writing the actual function code really cumbersome. For instance,
/// defining a binary function multiply that accepts two integers, possibly NULL, that
/// cannot be ersatzes (cf. [TypedAst::is_ersatz()]):
///
/// ```ignore
/// context.def_function(
///     "*",
///     TypeSpec::or(AstType::Integer, AstType::Null)
///         >> TypeSpec::or(AstType::Integer, AstType::Null)
///         >> AstType::Integer,
///     Rc::new(|args: Vec<TypedAst>| {
///         let left = match &args[0] {
///             TypedAst::Null => 1,
///             TypedAst::Integer(n) => *n,
///             _ => unreachable!("cannot happen because of prior typecheking"),
///         };
///         let right = match &args[1] {
///             TypedAst::Null => 1,
///             TypedAst::Integer(n) => *n,
///             _ => unreachable!("cannot happen because of prior typecheking"),
///         };
///         Ok(TypedAst::Integer(left * right))
///     }),
/// );
/// ```
///
/// It is annoying to unpack each argument one by one and crippling the code
/// with `unreachable!`. It would be better if the closure could take two arguments
/// instead. That's what the DSL does. It allows to encode the expected signature
/// of the function into Rust's typesystem and unwraps [TypedAst] values into
/// Rust conventional types.
///
/// # The DSL
///
/// Rewriting the function defined above using the DSL could be done this way:
///
/// ```ignore
/// context
///     .def_function_2::<dsl::Nullable<dsl::Integer>, dsl::Nullable<dsl::Integer>, dsl::Integer>(
///         "*",
///         Rc::new(|left: Option<i64>, right: Option<i64>| {
///             Ok(left.unwrap_or(1) * right.unwrap_or(1))
///         }),
///     );
/// ```
///
/// [QueryContext::def_function_2()] takes as generic type arguments implementations
/// of [Type] that provide the necessary compile-time information to infer both
/// the type of the closure and the [TypeSpec] of the function. That way, no more
/// `unreachable!` or awkward `match`es, and we get to use Rust types directly.
///
/// Furthermore, if you mess up the return value of the closure, since the Rust
/// compiler knows what type to expect, you will get a compile-time error. Unlike
/// before with [QueryContext::def_function()] where the compiler just expects a
/// [TypedAst] but cannot check that the variant makes sense with the return value's
/// [TypeSpec].
///
/// # [Type] implementations
///
/// - Straightforward implementations: [Null], [Boolean], [Integer], [Float], [String], [Nullable]
/// - [Sql]
/// - [Ersatz]
pub trait Type {
    type ArgType;
    type ReturnType;

    fn type_spec() -> TypeSpec;
    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError>;
    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError>;

    fn typecheck(value: &TypedAst) -> Result<(), ProcessingError> {
        if value.is_ersatz() {
            Err(ProcessingError::UnexpectedErsatz {
                value: format!("{value:?}"),
                expected: Self::type_spec(),
            })
        } else if !Self::type_spec().is_supertype_spec(&value.type_spec()) {
            Err(ProcessingError::RuntimeTypeCheckFail {
                value: format!("{value:?}"),
                expected: Self::type_spec(),
                actual: value.type_spec(),
            })
        } else {
            Ok(())
        }
    }
}

/// Represents [TypedAst::Null] and maps to `()`
pub struct Null;
/// Represents [TypedAst::Boolean] and maps to `bool`
pub struct Boolean;
/// Represents [TypedAst::Integer] and maps to `i64`
pub struct Integer;
/// Represents [TypedAst::Float] and maps to `f64`
pub struct Float;
/// Represents [TypedAst::String] and maps to [std::string::String]
pub struct String;
/// Represents [TypedAst::Sql]. As an argument, checks that the value typechecks
/// and exposes the [SqlQuery]. As a return value, wraps the [SqlQuery] into a
/// [TypedAst::Sql] with `T::type_spec()`
pub struct Sql<T: Type>(PhantomData<T>);
/// Represents a `T` that can be an ersatz. Maps to [TypedAst] both as an argument
/// and a return value. Check out [TypedAst::is_ersatz()]
pub struct Ersatz<T: Type>(PhantomData<T>);
/// Represents a nullable `T` which is either [TypedAst::Null] or `T`.
/// Maps to `Option<T::ArgType>` and `Option<T::ReturnType>`
pub struct Nullable<T: Type>(PhantomData<T>);
pub struct Array<T: Type>(PhantomData<T>);

impl Type for Null {
    type ArgType = ();
    type ReturnType = ();

    fn type_spec() -> TypeSpec {
        TypeSpec::Type(AstType::Null)
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        Ok(())
    }

    fn from_return(_: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::Null)
    }
}

impl Type for Boolean {
    type ArgType = bool;
    type ReturnType = bool;

    fn type_spec() -> TypeSpec {
        TypeSpec::Type(AstType::Boolean)
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::Boolean(b) = value else {
            unreachable!();
        };
        Ok(b)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::Boolean(value))
    }
}

impl Type for Integer {
    type ArgType = i64;
    type ReturnType = i64;

    fn type_spec() -> TypeSpec {
        TypeSpec::Type(AstType::Integer)
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::Integer(n) = value else {
            unreachable!();
        };
        Ok(n)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::Integer(value))
    }
}

impl Type for Float {
    type ArgType = f64;
    type ReturnType = f64;

    fn type_spec() -> TypeSpec {
        TypeSpec::Type(AstType::Float)
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::Float(n) = value else {
            unreachable!();
        };
        Ok(n)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::Float(value))
    }
}

impl Type for String {
    type ArgType = std::string::String;
    type ReturnType = std::string::String;

    fn type_spec() -> TypeSpec {
        TypeSpec::Type(AstType::String)
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::String(s) = value else {
            unreachable!();
        };
        Ok(s)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::String(value))
    }
}

impl<T: Type> Type for Sql<T> {
    type ArgType = SqlQuery;
    type ReturnType = SqlQuery;

    fn type_spec() -> TypeSpec {
        T::type_spec()
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::Sql(sql, _) = value else {
            unreachable!();
        };
        Ok(*sql)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        if let SqlQuery::Value(value) = value {
            Ok(value)
        } else {
            Ok(TypedAst::Sql(Box::new(value), Self::type_spec()))
        }
    }
}

impl<T: Type> Type for Ersatz<T> {
    type ArgType = TypedAst;
    type ReturnType = TypedAst;

    fn type_spec() -> TypeSpec {
        T::type_spec()
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        Ok(value)
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Self::typecheck(&value)?;
        Ok(value)
    }

    fn typecheck(value: &TypedAst) -> Result<(), ProcessingError> {
        match value {
            TypedAst::Column { spec, .. } | TypedAst::Sql(_, spec) => {
                if Self::type_spec().is_supertype_spec(spec) {
                    Ok(())
                } else {
                    Err(ProcessingError::RuntimeTypeCheckFail {
                        value: format!("{value:?}"),
                        expected: Self::type_spec(),
                        actual: value.type_spec(),
                    })
                }
            }
            value => T::typecheck(value),
        }
    }
}

impl<T: Type> Type for Nullable<T> {
    type ArgType = Option<T::ArgType>;
    type ReturnType = Option<T::ReturnType>;

    fn type_spec() -> TypeSpec {
        TypeSpec::Union(Box::new(T::type_spec()), Box::new(Null::type_spec()))
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        if let TypedAst::Null = value {
            Ok(None)
        } else {
            Ok(Some(T::into_arg(value)?))
        }
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(match value {
            Some(value) => T::from_return(value)?,
            None => TypedAst::Null,
        })
    }
}

impl<T: Type> Type for Array<T> {
    type ArgType = Vec<T::ArgType>;
    type ReturnType = Vec<T::ReturnType>;

    fn type_spec() -> TypeSpec {
        TypeSpec::seq(T::type_spec())
    }

    fn into_arg(value: TypedAst) -> Result<Self::ArgType, ProcessingError> {
        Self::typecheck(&value)?;
        let TypedAst::Sequence(items, _) = value else {
            unreachable!()
        };
        items.into_iter().map(T::into_arg).collect()
    }

    fn from_return(value: Self::ReturnType) -> Result<TypedAst, ProcessingError> {
        Ok(TypedAst::Sequence(
            value
                .into_iter()
                .map(T::from_return)
                .collect::<Result<Vec<_>, ProcessingError>>()?,
            T::type_spec(),
        ))
    }
}

impl QueryContext {
    /// Defines a unary function using the [Type] DSL
    ///
    /// ```ignore
    /// let mut context = QueryContext::default();
    /// context.def_function_1::<dsl::Nullable<dsl::Ersatz<dsl::Boolean>>, dsl::Sql<dsl::Boolean>>(
    ///     "not",
    ///     Rc::new(|x| Ok(SqlQuery::prefix("NOT", x))),
    /// );
    /// ```
    ///
    /// See [Type] for information about the DSL itself
    #[allow(clippy::type_complexity)]
    pub fn def_function_1<P1: Type + 'static, R: Type + 'static>(
        &mut self,
        name: &'static str,
        fun: Rc<dyn Fn(P1::ArgType) -> Result<R::ReturnType, std::string::String>>,
    ) {
        self.def_function(
            name,
            P1::type_spec() >> R::type_spec(),
            Rc::new(move |args| {
                let value =
                    fun(P1::into_arg(args.into_iter().next().unwrap())?).map_err(|error| {
                        ProcessingError::FunctionError {
                            function: name.to_owned(),
                            error,
                        }
                    })?;
                R::from_return(value)
            }),
        )
    }

    /// Defines a binary function using the [Type] DSL
    ///
    /// ```ignore
    /// let mut env = create_processing_context();
    /// env.def_function_2::<dsl::Integer, dsl::Integer, dsl::Integer>(
    ///     "+",
    ///     Rc::new(|a, b| Ok(a + b)),
    /// );
    /// ```
    ///
    /// See [Type] for information about the DSL itself
    #[allow(clippy::type_complexity)]
    pub fn def_function_2<P1: Type + 'static, P2: Type + 'static, R: Type + 'static>(
        &mut self,
        name: &'static str,
        fun: Rc<dyn Fn(P1::ArgType, P2::ArgType) -> Result<R::ReturnType, std::string::String>>,
    ) {
        self.def_function(
            name,
            P1::type_spec() >> P2::type_spec() >> R::type_spec(),
            Rc::new(move |args| {
                let mut args = args.into_iter();
                let value = fun(
                    P1::into_arg(args.next().unwrap())?,
                    P2::into_arg(args.next().unwrap())?,
                )
                .map_err(|error| ProcessingError::FunctionError {
                    function: name.to_owned(),
                    error,
                })?;
                R::from_return(value)
            }),
        )
    }
}
