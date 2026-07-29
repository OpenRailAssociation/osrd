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
    }

    mod newtype {
        use super::*;

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
    }

    mod tuple {
        use super::*;

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
    }

    mod named {
        use super::*;

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
        }
    }
}
