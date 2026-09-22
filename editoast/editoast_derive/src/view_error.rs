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

    #[test]
    fn unit_struct() {
        crate::assert_macro_expansion!(
            view_error,
            syn::parse_quote! {
                struct Unit;
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
    fn struct_named_fields() {
        crate::assert_macro_expansion!(
            view_error,
            syn::parse_quote! {
                #[error("named error")]
                #[view_error(context)]
                struct Named {
                    source: std::io::Error,
                    context: String,
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
                    #[error("own error: {detail}")]
                    #[view_error(status = BAD_REQUEST)]
                    Own { detail: String },
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
}
