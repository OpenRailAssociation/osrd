//! Defines the low-level structures used by typecheking operations
use std::collections::hash_map::DefaultHasher;
use std::collections::VecDeque;
use std::fmt::Display;
use std::hash::Hash;
use std::hash::Hasher;
use std::hash::{self};
use std::ops::Shr;

use serde::Deserialize;

#[derive(Debug, thiserror::Error)]
pub enum TypeCheckError {
    #[error("expected variadic argument of type {expected}, but got {actual}")]
    VariadicArgTypeMismatch {
        expected: TypeSpec,
        actual: TypeSpec,
    },
    #[error("expected argument of type {expected} at position {arg_pos}, but got {actual}")]
    ArgTypeMismatch {
        expected: TypeSpec,
        actual: TypeSpec,
        arg_pos: usize,
    },
    #[error("expected argument of type {expected} at position {arg_pos} is missing")]
    ArgMissing { expected: TypeSpec, arg_pos: usize },
    #[error("unexpected argument of type {arg_type} found")]
    UnexpectedArg { arg_type: TypeSpec },
}

/// Defines all the atomic types that are expressible by the search query language
///
/// See [TypeSpec].
#[derive(Debug, PartialEq, Eq, Clone, Copy, strum::Display, Hash, strum::EnumIter, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AstType {
    Null,
    Boolean,
    Integer,
    Float,
    String,
}

/// Allows combining [AstType]s in order to express more complex types
#[derive(Debug, Clone)]
pub enum TypeSpec {
    Any,
    Type(AstType),
    Union(Box<TypeSpec>, Box<TypeSpec>),
    Sequence(Box<TypeSpec>),
    Variadic(Box<TypeSpec>),
    Function {
        args: Vec<TypeSpec>,
        result: Box<TypeSpec>,
    },
}

impl From<AstType> for TypeSpec {
    fn from(value: AstType) -> Self {
        Self::Type(value)
    }
}

impl<T: Into<TypeSpec>> Shr<T> for AstType {
    type Output = TypeSpec;

    fn shr(self, rhs: T) -> Self::Output {
        TypeSpec::Type(self) >> rhs.into()
    }
}

impl Shr for TypeSpec {
    type Output = Self;

    fn shr(self, rhs: Self) -> Self::Output {
        if let Self::Function { mut args, result } = self {
            if let Some(Self::Variadic(_)) = args.last() {
                let variadic = args.last().unwrap();
                panic!("cannot extend function with {rhs:?} as that would put argument type {result:?} after variadic type specifier {variadic:?}");
            }
            args.push(*result);
            Self::Function {
                args,
                result: Box::new(rhs),
            }
        } else {
            Self::Function {
                args: vec![self],
                result: Box::new(rhs),
            }
        }
    }
}

impl Shr<AstType> for TypeSpec {
    type Output = Self;

    fn shr(self, rhs: AstType) -> Self::Output {
        self >> Into::<Self>::into(rhs)
    }
}

impl Display for TypeSpec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TypeSpec::Type(t) => write!(f, "{t}"),
            TypeSpec::Union(left, right) => write!(f, "{left} | {right}"),
            TypeSpec::Variadic(t) => write!(f, "variadic {t}"),
            TypeSpec::Function { args, result } => {
                write!(
                    f,
                    "{0} -> {result}",
                    args.iter()
                        .map(|t| format!("{t}"))
                        .collect::<Vec<String>>()
                        .join(" -> ")
                )
            }
            TypeSpec::Sequence(item) => write!(f, "[{item}]"),
            TypeSpec::Any => write!(f, "Any"),
        }
    }
}

impl AstType {
    /// Returns whether `self` ⊇ `type_`
    pub fn is_supertype(&self, type_: &AstType) -> bool {
        self == type_
    }

    /// Returns whether `self` ⊇ `spec`
    pub fn is_supertype_spec(&self, spec: &TypeSpec) -> bool {
        TypeSpec::Type(self.to_owned()).is_supertype_spec(spec)
    }
}

impl TypeSpec {
    pub fn varg<T: Into<TypeSpec>>(type_: T) -> TypeSpec {
        TypeSpec::Variadic(Box::new(type_.into()))
    }

    pub fn or<T: Into<TypeSpec>, U: Into<TypeSpec>>(left: T, right: U) -> TypeSpec {
        TypeSpec::Union(Box::new(left.into()), Box::new(right.into()))
    }

    pub fn seq<T: Into<TypeSpec>>(item: T) -> TypeSpec {
        TypeSpec::Sequence(Box::new(item.into()))
    }

    /// Returns whether `self` ⊇ `type_`
    pub fn is_supertype(&self, type_: &AstType) -> bool {
        match self {
            TypeSpec::Any => true,
            TypeSpec::Type(t) => t.is_supertype(type_),
            TypeSpec::Union(left, right) => left.is_supertype(type_) || right.is_supertype(type_),
            TypeSpec::Variadic(t) => t.is_supertype(type_),
            TypeSpec::Function { args, .. } => args.is_empty(),
            TypeSpec::Sequence(_) => false,
        }
    }

    /// Returns whether `self` ⊇ `spec`
    pub fn is_supertype_spec(&self, spec: &TypeSpec) -> bool {
        if self == &TypeSpec::Any {
            return true;
        };
        match spec {
            TypeSpec::Any => false,
            TypeSpec::Type(t) => self.is_supertype(t),
            TypeSpec::Union(left, right) => {
                self.is_supertype_spec(left) && self.is_supertype_spec(right)
            }
            TypeSpec::Variadic(_) => {
                panic!("cannot use TypeSpec::typecheck_spec with RHS variadic: {spec:?}")
            }
            TypeSpec::Function { .. } => {
                panic!("cannot use TypeSpec::typecheck_spec with RHS function signature: {spec:?}")
            }
            TypeSpec::Sequence(other_item_spec) => {
                if let TypeSpec::Sequence(item_spec) = self {
                    item_spec.is_supertype_spec(other_item_spec)
                } else {
                    false
                }
            }
        }
    }

    /// Returns whether the function signature `self` accepts the `args` [TypeSpec]
    /// list as arguments
    ///
    /// Panics if `self` is not a [TypeSpec::Function] signature.
    pub fn typecheck_args(&self, args: &[TypeSpec]) -> Result<(), TypeCheckError> {
        let TypeSpec::Function { args: fargs, .. } = self else {
            panic!("typecheck_args called with {self:?} which is not a function signature");
        };
        let mut args_iter = args.iter();
        for (i, expected) in fargs.iter().enumerate() {
            if let TypeSpec::Variadic(expected) = expected {
                // By construction it is guaranteed that this is the last iteration
                // so we consume all the arguments.
                for arg in args_iter {
                    if !expected.is_supertype_spec(arg) {
                        return Err(TypeCheckError::VariadicArgTypeMismatch {
                            expected: (**expected).clone(),
                            actual: (*arg).clone(),
                        });
                    }
                }
                // We need to explicitly break here otherwise rust will try
                // to reborrow args_iter below, which fails.
                return Ok(());
            } else {
                match args_iter.next() {
                    Some(arg) if expected.is_supertype_spec(arg) => (),
                    Some(arg) => {
                        return Err(TypeCheckError::ArgTypeMismatch {
                            expected: (*expected).clone(),
                            actual: (*arg).clone(),
                            arg_pos: i,
                        })
                    }
                    None => {
                        return Err(TypeCheckError::ArgMissing {
                            expected: (*expected).clone(),
                            arg_pos: i,
                        })
                    }
                }
            }
        }
        match args_iter.next() {
            Some(arg) => Err(TypeCheckError::UnexpectedArg {
                arg_type: (*arg).clone(),
            }),
            None => Ok(()),
        }
    }

    /// Returns an iterator over tha flattened alternatives of a union
    pub fn iter_union_alternatives(&self) -> Alternatives {
        if matches!(self, Self::Union(_, _)) {
            Alternatives {
                stack: VecDeque::from([self]),
            }
        } else {
            Alternatives {
                stack: Default::default(),
            }
        }
    }
}

pub struct Alternatives<'a> {
    stack: VecDeque<&'a TypeSpec>,
}

impl<'a> Iterator for Alternatives<'a> {
    type Item = &'a TypeSpec;

    fn next(&mut self) -> Option<Self::Item> {
        let spec = self.stack.pop_front()?;
        if let TypeSpec::Union(left, right) = spec {
            self.stack.push_back(left);
            self.stack.push_back(right);
            self.next()
        } else {
            Some(spec)
        }
    }
}

impl Hash for TypeSpec {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        core::mem::discriminant(self).hash(state);
        if matches!(self, Self::Union(_, _)) {
            for alternative in self.iter_union_alternatives() {
                alternative.hash(state);
            }
        }
    }
}

fn hash_eq<T: hash::Hash>(a: &T, b: &T) -> bool {
    let mut ha = DefaultHasher::new();
    let mut hb = DefaultHasher::new();
    a.hash(&mut ha);
    b.hash(&mut hb);
    ha.finish() == hb.finish()
}

impl PartialEq for TypeSpec {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Any, Self::Any) => true,
            (Self::Type(lts), Self::Type(rts)) => lts == rts,
            (Self::Union(_, _), Self::Union(_, _)) => hash_eq(self, other),
            (Self::Sequence(lts), Self::Sequence(rts)) => lts == rts,
            (Self::Variadic(lts), Self::Variadic(rts)) => lts == rts,
            (
                Self::Function {
                    args: l_args,
                    result: l_result,
                },
                Self::Function {
                    args: r_args,
                    result: r_result,
                },
            ) => l_args == r_args && l_result == r_result,
            _ => false,
        }
    }
}

impl Eq for TypeSpec {}

#[cfg(test)]
mod tests {

    use super::AstType;
    use crate::typing::hash_eq;
    use crate::typing::TypeSpec;

    #[test]
    fn test_rhs_function_signature() {
        assert_eq!(
            AstType::Integer >> AstType::String,
            TypeSpec::Function {
                args: vec![AstType::Integer.into()],
                result: Box::new(AstType::String.into())
            }
        );
        assert_eq!(
            AstType::Float >> AstType::Integer >> AstType::String,
            TypeSpec::Function {
                args: vec![AstType::Float.into(), AstType::Integer.into()],
                result: Box::new(AstType::String.into())
            }
        );
        assert_eq!(
            TypeSpec::varg(AstType::Integer) >> AstType::String,
            TypeSpec::Function {
                args: vec![TypeSpec::Variadic(Box::new(AstType::Integer.into()))],
                result: Box::new(AstType::String.into())
            }
        );
    }

    #[test]
    #[should_panic]
    fn test_panic_arg_after_variadic() {
        let _ = TypeSpec::varg(AstType::Integer) >> AstType::Null >> AstType::String;
    }

    #[test]
    fn test_typecheck_simple() {
        assert!(AstType::Null.is_supertype(&AstType::Null));
        assert!(!AstType::Null.is_supertype(&AstType::Integer));
        assert!(!AstType::Integer.is_supertype(&AstType::Null));
        assert!(AstType::Integer.is_supertype(&AstType::Integer));
        assert!(!AstType::Integer.is_supertype(&AstType::String));
        // Float \cap Integer = \O
        // NOTE: on a totally unrelated note, the scandinavian slashed O
        // is historically the correct symbol for the empty set
        // cf. https://tex.stackexchange.com/questions/28493/nothing-varnothing-and-emptyset/29364#29364
        assert!(!AstType::Integer.is_supertype(&AstType::Float));
        assert!(!AstType::Float.is_supertype(&AstType::Integer));
    }

    #[test]
    fn test_typecheck_union() {
        assert!(TypeSpec::or(AstType::Integer, AstType::Float).is_supertype(&AstType::Integer));
        assert!(TypeSpec::or(AstType::Integer, AstType::Float).is_supertype(&AstType::Float));
        assert!(!TypeSpec::or(AstType::Integer, AstType::Float).is_supertype(&AstType::String));
        assert!(!TypeSpec::or(AstType::Integer, AstType::Float).is_supertype(&AstType::Null));
        assert!(TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::String, AstType::Null)
        )
        .is_supertype(&AstType::Integer));
        assert!(TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::String, AstType::Null)
        )
        .is_supertype(&AstType::String));
        assert!(TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::String, AstType::Null)
        )
        .is_supertype(&AstType::Null));
        assert!(TypeSpec::or(AstType::String, AstType::String).is_supertype(&AstType::String));
    }

    #[test]
    fn test_typecheck_any() {
        assert!(TypeSpec::Any.is_supertype_spec(&AstType::Null.into()));
        assert!(TypeSpec::Any.is_supertype_spec(&AstType::Boolean.into()));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::or(AstType::Integer, AstType::Float)));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::or(
            AstType::Integer,
            TypeSpec::seq(AstType::Float)
        )));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::seq(TypeSpec::or(
            AstType::Integer,
            TypeSpec::seq(AstType::Float)
        ))));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::Any));
    }

    #[test]
    fn test_typecheck_function_simple() {
        // Correct types
        assert!((AstType::Integer >> AstType::Integer >> AstType::String)
            .typecheck_args(&[AstType::Integer.into(), AstType::Integer.into()])
            .is_ok());
        assert!((AstType::Integer >> AstType::Integer >> AstType::String)
            .typecheck_args(&[AstType::Integer.into(), AstType::String.into()])
            .is_err());
        // Correct arity
        assert!((AstType::Integer >> AstType::Integer >> AstType::String)
            .typecheck_args(&[AstType::Integer.into(),])
            .is_err());
        assert!((AstType::Integer >> AstType::Integer >> AstType::String)
            .typecheck_args(&[
                AstType::Integer.into(),
                AstType::Integer.into(),
                AstType::String.into()
            ])
            .is_err());
        // Correct order
        assert!((AstType::Integer >> AstType::Boolean >> AstType::String)
            .typecheck_args(&[AstType::Integer.into(), AstType::Boolean.into()])
            .is_ok());
        assert!((AstType::Integer >> AstType::Boolean >> AstType::String)
            .typecheck_args(&[AstType::Boolean.into(), AstType::Integer.into()])
            .is_err());
        // No coersion from missing to null
        assert!((AstType::Integer >> AstType::String >> AstType::String)
            .typecheck_args(&[AstType::String.into()])
            .is_err());
    }

    #[test]
    fn test_typecheck_function_union() {
        assert!((TypeSpec::or(AstType::Integer, AstType::Boolean)
            >> TypeSpec::or(AstType::String, AstType::Null)
            >> AstType::Null)
            .typecheck_args(&[AstType::Integer.into(), AstType::Null.into()])
            .is_ok());
        assert!((TypeSpec::or(AstType::Integer, AstType::Boolean)
            >> TypeSpec::or(AstType::String, AstType::Null)
            >> AstType::Null)
            .typecheck_args(&[AstType::Boolean.into(), AstType::String.into()])
            .is_ok());
        assert!((TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::Float, AstType::String)
        ) >> AstType::Null)
            .typecheck_args(&[TypeSpec::or(AstType::Float, AstType::String)])
            .is_ok());
        assert!((TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::Float, AstType::String)
        ) >> AstType::Null)
            .typecheck_args(&[TypeSpec::or(AstType::String, AstType::Integer)])
            .is_ok());
        assert!((TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::Float, AstType::String)
        ) >> AstType::Null)
            .typecheck_args(&[TypeSpec::or(AstType::Integer, AstType::Integer)])
            .is_ok());
        assert!((TypeSpec::or(
            AstType::Integer,
            TypeSpec::or(AstType::Float, AstType::String)
        ) >> AstType::Null)
            .typecheck_args(&[TypeSpec::or(AstType::Float, AstType::Boolean)])
            .is_err());
    }

    #[test]
    fn test_typecheck_function_variadic() {
        assert!((TypeSpec::varg(AstType::Integer) >> AstType::Null)
            .typecheck_args(&[])
            .is_ok());
        assert!((TypeSpec::varg(AstType::Integer) >> AstType::Null)
            .typecheck_args(&[AstType::Integer.into()])
            .is_ok());
        assert!((TypeSpec::varg(AstType::Integer) >> AstType::Null)
            .typecheck_args(&[AstType::Integer.into(), AstType::Integer.into()])
            .is_ok());
        assert!((TypeSpec::varg(AstType::Integer) >> AstType::Null)
            .typecheck_args(&[
                AstType::Integer.into(),
                AstType::Integer.into(),
                AstType::Integer.into()
            ])
            .is_ok());
        assert!(
            (AstType::String >> TypeSpec::varg(AstType::Integer) >> AstType::Null)
                .typecheck_args(&[
                    AstType::String.into(),
                    AstType::Integer.into(),
                    AstType::Integer.into()
                ])
                .is_ok()
        );
        assert!(
            (AstType::String >> TypeSpec::varg(AstType::Integer) >> AstType::Null)
                .typecheck_args(&[
                    AstType::Integer.into(),
                    AstType::Integer.into(),
                    AstType::Integer.into()
                ])
                .is_err()
        );
        assert!(
            (AstType::String >> TypeSpec::varg(AstType::String) >> AstType::Null)
                .typecheck_args(&[
                    AstType::String.into(),
                    AstType::String.into(),
                    AstType::String.into()
                ])
                .is_ok()
        );
    }

    #[test]
    fn test_typecheck_sequence() {
        assert!(!TypeSpec::seq(AstType::String).is_supertype(&AstType::String));
        assert!(TypeSpec::seq(AstType::String).is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(TypeSpec::seq(TypeSpec::or(AstType::String, AstType::Null))
            .is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(!TypeSpec::seq(AstType::String)
            .is_supertype_spec(&TypeSpec::seq(TypeSpec::or(AstType::String, AstType::Null))));
        assert!(!TypeSpec::seq(TypeSpec::seq(AstType::String))
            .is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(!TypeSpec::seq(AstType::String)
            .is_supertype_spec(&TypeSpec::seq(TypeSpec::seq(AstType::String))));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(TypeSpec::Any.is_supertype_spec(&TypeSpec::seq(TypeSpec::Any)));
        assert!(TypeSpec::seq(TypeSpec::Any).is_supertype_spec(&TypeSpec::seq(TypeSpec::Any)));
        assert!(TypeSpec::seq(TypeSpec::Any).is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(!TypeSpec::seq(TypeSpec::Any).is_supertype_spec(&TypeSpec::Any));
        assert!(TypeSpec::seq(TypeSpec::or(AstType::String, TypeSpec::Any))
            .is_supertype_spec(&TypeSpec::seq(AstType::String)));
        assert!(TypeSpec::seq(TypeSpec::or(AstType::String, TypeSpec::Any))
            .is_supertype_spec(&TypeSpec::seq(AstType::Float)));
    }

    #[test]
    fn test_hash_typespec() {
        assert!(hash_eq(
            &TypeSpec::or(AstType::String, AstType::Integer),
            &TypeSpec::or(AstType::Integer, AstType::String)
        ));
        assert!(hash_eq(
            &TypeSpec::or(AstType::String, AstType::String),
            &TypeSpec::or(AstType::String, AstType::String)
        ));
        assert!(hash_eq(
            &TypeSpec::or(
                AstType::String,
                TypeSpec::or(AstType::Integer, AstType::Float)
            ),
            &TypeSpec::or(
                TypeSpec::or(AstType::Integer, AstType::Float),
                AstType::String
            )
        ));
        assert!(hash_eq(
            &TypeSpec::or(
                AstType::String,
                TypeSpec::or(AstType::Integer, AstType::Float)
            ),
            &TypeSpec::or(
                TypeSpec::or(AstType::String, AstType::Float),
                AstType::Integer
            )
        ));
    }

    #[test]
    fn test_union_alternative_irrelevant_order() {
        assert_eq!(
            TypeSpec::or(AstType::String, AstType::Integer),
            TypeSpec::or(AstType::Integer, AstType::String)
        );
        assert_eq!(
            TypeSpec::or(AstType::String, AstType::String),
            TypeSpec::or(AstType::String, AstType::String)
        );
        assert_eq!(
            TypeSpec::or(
                AstType::String,
                TypeSpec::or(AstType::Integer, AstType::Float)
            ),
            TypeSpec::or(
                TypeSpec::or(AstType::Integer, AstType::Float),
                AstType::String
            )
        );
        assert_eq!(
            TypeSpec::or(
                AstType::String,
                TypeSpec::or(AstType::Integer, AstType::Float)
            ),
            TypeSpec::or(
                TypeSpec::or(AstType::String, AstType::Float),
                AstType::Integer
            )
        );
    }
}
