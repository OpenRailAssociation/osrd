mod args;
mod codegen;

use darling::FromDeriveInput as _;
use darling::Result;
use proc_macro2::TokenStream;
use syn::DeriveInput;

pub fn view_error(input: &DeriveInput) -> Result<TokenStream> {
    let args = args::Args::from_derive_input(input)?;
    let codegen = args.parse()?;
    Ok(quote::quote! { #codegen })
}

#[cfg(test)]
mod tests {
    use super::*;

    mod unit_struct {
        use super::*;

        #[test]
        fn default() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct Unit;
                }
            );
        }

        #[test]
        fn name_override() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(name = "custom_name")]
                    struct Unit;
                }
            );
        }

        #[test]
        fn status() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(status = NOT_FOUND)]
                    struct Unit;
                }
            );
        }

        #[test]
        fn context() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(context)]
                    struct UnitWithContext;
                }
            );
        }

        #[test]
        fn error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error("unit error")]
                    #[view_error(context)]
                    struct UnitError;
                }
            );
        }
    }

    mod newtype {
        use super::*;

        #[test]
        fn forwarded_view_error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error(transparent)]
                    struct Wrapper(#[from] #[view_error] errors::InnerError);
                }
            );
        }

        #[test]
        fn forwarded_view_error_field_does_not_accept_arguments() {
            let input = syn::parse_quote! {
                struct Error(#[view_error(context)] InnerError);
            };
            let error = view_error(&input).expect_err("field arguments should be rejected");
            assert!(
                error
                    .to_string()
                    .contains("`#[view_error]` does not accept arguments on fields"),
                "unexpected error: {error}"
            );
        }

        #[test]
        fn default() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct NewType(String);
                }
            );
        }

        #[test]
        fn name_override() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(name = "custom_name")]
                    struct NewType(String);
                }
            );
        }

        #[test]
        fn status() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(status = NOT_FOUND)]
                    struct NewType(String);
                }
            );
        }

        #[test]
        fn context() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(context)]
                    struct NewType(String);
                }
            );
        }

        #[test]
        fn error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error(transparent)]
                    #[view_error(context)]
                    struct NewTypeError(std::io::Error);
                }
            );
        }
    }

    mod tuple {
        use super::*;

        #[test]
        fn forwarded_view_error_with_additional_field() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct Error(#[view_error] InnerError, String);
                }
            );
        }

        #[test]
        fn default() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct Tuple(String, u32);
                }
            );
        }

        #[test]
        fn name_override() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(name = "custom_name")]
                    struct Tuple(String, u32);
                }
            );
        }

        #[test]
        fn status() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(status = NOT_FOUND)]
                    struct Tuple(String, u32);
                }
            );
        }

        #[test]
        fn context() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(context)]
                    struct Tuple(String, u32);
                }
            );
        }

        #[test]
        fn error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error("tuple error")]
                    #[view_error(context)]
                    struct TupleError(#[source] std::io::Error, String);
                }
            );
        }
    }

    mod named {
        use super::*;

        #[test]
        fn forwarded_view_error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error("the outer message is replaced")]
                    #[view_error(status = IM_A_TEAPOT, context)]
                    struct Wrapper {
                        #[view_error]
                        inner: InnerError,
                    }
                }
            );
        }

        #[test]
        fn forwarded_view_error_with_additional_field() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct Error {
                        #[view_error]
                        inner: InnerError,
                        context: String,
                    }
                }
            );
        }

        #[test]
        fn default() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    struct Named {
                        field: String,
                    }
                }
            );
        }

        #[test]
        fn name_override() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(name = "custom_name")]
                    struct Named {
                        field: String,
                    }
                }
            );
        }

        #[test]
        fn status() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(status = UNAUTHORIZED)]
                    struct Named {
                        field: String,
                    }
                }
            );
        }

        #[test]
        fn context() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[view_error(context)]
                    struct NamedWithContext {
                        cause: String,
                        fix: String,
                        incident_id: u64,
                    }
                }
            );
        }

        #[test]
        fn error() {
            crate::assert_macro_expansion!(
                view_error,
                syn::parse_quote! {
                    #[error("named error")]
                    #[view_error(context)]
                    struct NamedError {
                        source: std::io::Error,
                        context: String,
                    }
                }
            );
        }
    }

    mod enums {
        use super::*;

        mod c_like {
            use super::*;

            #[test]
            fn default() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        #[view_error]
                        enum Color {
                            Red,
                            Green,
                            Blue,
                        }
                    }
                );
            }
        }

        mod mixed {
            use super::*;

            #[test]
            fn default() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        #[view_error]
                        enum Mixed {
                            Unit,
                            NewType(String),
                            Tuple(String, u32),
                            Rich {
                                cause: String,
                                fix: String,
                                incident_id: u64,
                            },
                        }
                    }
                );
            }

            #[test]
            fn status() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        enum Mixed {
                            Unit, // default status code 500
                            #[view_error(status = INTERNAL_SERVER_ERROR)]
                            NewType(String),
                            #[view_error(status = BAD_REQUEST)]
                            Tuple(String, u32),
                            #[view_error(status = PAYMENT_REQUIRED)]
                            Rich {
                                cause: String,
                                fix: String,
                                incident_id: u64,
                            },
                        }
                    }
                );
            }

            #[test]
            fn derive_more_from_skip_is_not_supported() {
                let input = syn::parse_quote! {
                    enum Error {
                        #[from(skip)]
                        Variant(String),
                    }
                };
                let error = view_error(&input).expect_err("opt-out conversions should be rejected");
                assert!(
                    error
                        .to_string()
                        .contains("`#[from(skip)]` is not supported by `ViewError`"),
                    "unexpected error: {error}"
                );
            }

            #[test]
            fn derive_more_from_ignore_is_not_supported() {
                let input = syn::parse_quote! {
                    enum Error {
                        #[from(ignore)]
                        Variant(String),
                    }
                };
                let error = view_error(&input).expect_err("opt-out conversions should be rejected");
                assert!(
                    error
                        .to_string()
                        .contains("`#[from(ignore)]` is not supported by `ViewError`"),
                    "unexpected error: {error}"
                );
            }

            #[test]
            fn forwarded_view_error_with_additional_tuple_variant_field() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        enum Error {
                            Variant(#[view_error] InnerError, String),
                        }
                    }
                );
            }

            #[test]
            fn forwarded_view_error_with_additional_named_variant_field() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        enum Error {
                            Variant {
                                #[view_error]
                                inner: InnerError,
                                context: String,
                            },
                        }
                    }
                );
            }

            #[test]
            fn forwarded_view_error() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        #[view_error(context)]
                        enum Wrapper {
                            #[error(transparent)]
                            Transparent(#[view_error] InnerError),
                            #[error("converted source")]
                            From(#[from] #[view_error] InnerError),
                            #[error("explicit source")]
                            Source {
                                #[source]
                                #[view_error]
                                inner: InnerError,
                            },
                            #[error("plain value")]
                            #[view_error(status = IM_A_TEAPOT, context)]
                            Plain(#[view_error] InnerError),
                            #[error("own error: {detail}")]
                            #[view_error(status = BAD_REQUEST)]
                            Own { detail: String },
                        }
                    }
                );
            }

            #[test]
            fn sources_are_excluded_from_context() {
                crate::assert_macro_expansion!(
                    view_error,
                    syn::parse_quote! {
                        #[view_error(context)]
                        enum Sources {
                            #[error("implicit source")]
                            Implicit {
                                source: std::io::Error,
                                context: String,
                            },
                            #[error("explicit source")]
                            Explicit {
                                #[source]
                                my_error: std::io::Error,
                                context: String,
                            },
                            #[error("inline #[from], inferred as source")]
                            From(#[from] std::io::Error),
                            #[error(transparent)] // inferred as source as well
                            Transparent(std::io::Error),
                            #[error("derive_more conversion without #[source], not a source error")]
                            #[from(InnerError)]
                            DeriveMore(InnerError),
                        }
                    }
                );
            }
        }
    }
}
