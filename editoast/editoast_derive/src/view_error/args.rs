use darling::FromDeriveInput;
use darling::FromField;
use darling::FromMeta;
use darling::FromVariant;
use darling::Result;
use darling::ast;
use proc_macro2::Span;
use quote::quote;
use syn::ext::IdentExt as _;
use syn::parse::Parser as _;

use crate::view_error::codegen::Codegen;
use crate::view_error::codegen::Context;
use crate::view_error::codegen::ContextEntry;
use crate::view_error::codegen::ContextEntrySpec;
use crate::view_error::codegen::OpenApiResponse;
use crate::view_error::codegen::ViewErrorImpl;

#[derive(Debug, FromDeriveInput)]
#[darling(
    attributes(view_error),
    forward_attrs(allow, doc, cfg, from, error),
    supports(
        struct_newtype,
        struct_named,
        struct_tuple,
        struct_unit,
        enum_named,
        enum_tuple,
        enum_unit,
    )
)]
pub(super) struct Args {
    ident: syn::Ident,
    data: ast::Data<VariantArgs, FieldArgs>,
    #[darling(with = ErrorAttrs::parse)]
    attrs: ErrorAttrs,

    /// Changes the base name of the error label
    #[darling(default)]
    name: Option<String>,

    /// Whether to include type data into the error `context` field
    ///
    /// Default: false
    #[darling(default)]
    context: bool,

    #[darling(flatten)]
    args: TypeArgs,
}

/// Args on the type itself and not its content
#[derive(Debug, FromMeta)]
struct TypeArgs {
    #[darling(default)]
    status: StatusCodeArg,
}

#[derive(Debug, FromVariant)]
#[darling(attributes(view_error), forward_attrs(allow, doc, cfg, from, error))]
struct VariantArgs {
    ident: syn::Ident,
    fields: ast::Fields<FieldArgs>,
    #[darling(with = ErrorAttrs::parse)]
    attrs: ErrorAttrs,

    #[darling(default)]
    status: StatusCodeArg,
    #[darling(default)]
    context: bool,
}

#[derive(Debug, FromField)]
struct FieldArgs {
    ident: Option<syn::Ident>,
    ty: syn::Type,
}

/// Parses `thiserror`'s `error` attribute on a type or enum variant
///
/// Supports `#[error("format_string", interpolated_values*)]` and `#[error(transparent)]` forms.
/// Interpolated values are ignored.
#[derive(Debug)]
struct ErrorAttrs {
    message: Option<String>,
}

#[derive(Debug, Clone, FromMeta)]
pub(super) struct StatusCodeArg(pub(super) syn::Ident);

impl Default for StatusCodeArg {
    fn default() -> Self {
        Self(syn::parse_quote! { INTERNAL_SERVER_ERROR })
    }
}

impl Args {
    pub(super) fn parse(self) -> Result<Codegen> {
        let Self {
            ident,
            data,
            attrs: ErrorAttrs {
                message: message_template,
            },
            name,
            context: context_on_type,
            args: TypeArgs { status },
        } = self;
        let label = name.unwrap_or_else(|| ident.to_string());

        let view_error_impl = match data {
            ast::Data::Struct(fields) => {
                let pattern = fields.pattern(None);
                let context_entries = if context_on_type {
                    fields.context()
                } else {
                    Vec::new()
                };
                let openapi_context = if context_on_type {
                    fields.openapi_context_spec()
                } else {
                    Vec::new()
                };

                ViewErrorImpl {
                    implementor: ident,
                    label,
                    status_impl: vec![(pattern.clone(), status.clone())],
                    variant_label_impl: None,
                    context_impl: vec![(
                        pattern,
                        Context {
                            entries: context_entries,
                        },
                    )],
                    responses_impl: vec![OpenApiResponse {
                        sub_label: None,
                        status,
                        message_template,
                        context: openapi_context,
                    }],
                }
            }
            ast::Data::Enum(variants) => {
                let mut status_impl = Vec::with_capacity(variants.len());
                let mut variant_label_impl = Vec::with_capacity(variants.len());
                let mut context_impl = Vec::with_capacity(variants.len());
                let mut responses_impl = Vec::with_capacity(variants.len());

                for variant in variants {
                    let VariantArgs {
                        ident: variant_ident,
                        fields,
                        attrs:
                            ErrorAttrs {
                                message: message_template,
                            },
                        status,
                        context: context_on_variant,
                    } = variant;
                    let sub_label = variant_ident.to_string();
                    let pattern = fields.pattern(Some(&variant_ident));
                    let context_entries = if context_on_type || context_on_variant {
                        fields.context()
                    } else {
                        Vec::new()
                    };
                    let openapi_context = if context_on_type || context_on_variant {
                        fields.openapi_context_spec()
                    } else {
                        Vec::new()
                    };

                    status_impl.push((pattern.clone(), status.clone()));
                    variant_label_impl.push((pattern.clone(), sub_label.clone()));
                    context_impl.push((
                        pattern,
                        Context {
                            entries: context_entries,
                        },
                    ));
                    responses_impl.push(OpenApiResponse {
                        sub_label: Some(sub_label),
                        status,
                        message_template,
                        context: openapi_context,
                    });
                }

                ViewErrorImpl {
                    implementor: ident,
                    label,
                    status_impl,
                    variant_label_impl: Some(variant_label_impl),
                    context_impl,
                    responses_impl,
                }
            }
        };

        Ok(Codegen(view_error_impl))
    }
}

// It's convenient to implement extensions on `ast::Fields` as it is used for both
// structs and enum variants.
trait AstFieldsExt {
    fn pattern(&self, self_variant: Option<&syn::Ident>) -> syn::Pat;
    fn context(&self) -> Vec<ContextEntry>;
    fn openapi_context_spec(&self) -> Vec<ContextEntrySpec>;
    fn bindings(&self) -> Vec<syn::Ident>;
}

impl AstFieldsExt for ast::Fields<FieldArgs> {
    fn pattern(&self, self_variant: Option<&syn::Ident>) -> syn::Pat {
        let bindings = self.bindings();
        let head = self_variant
            .map(|self_variant| quote! { Self::#self_variant })
            .unwrap_or_else(|| quote! { Self });
        let pattern = match self.style {
            ast::Style::Unit => quote! { #head },
            ast::Style::Tuple => quote! { #head(#(#bindings),*) },
            ast::Style::Struct => {
                let fields = self
                    .fields
                    .iter()
                    .map(|field| field.ident.as_ref().unwrap());
                quote! { #head { #(#fields: #bindings),* } }
            }
        };
        syn::Pat::parse_single.parse2(pattern).unwrap()
    }

    fn context(&self) -> Vec<ContextEntry> {
        self.fields
            .iter()
            .zip(self.bindings())
            .enumerate()
            .map(|(index, (field, binding))| ContextEntry {
                key: field.key(index),
                binding,
            })
            .collect()
    }

    fn openapi_context_spec(&self) -> Vec<ContextEntrySpec> {
        self.fields
            .iter()
            .enumerate()
            .map(|(index, field)| ContextEntrySpec {
                key: field.key(index),
                ty: field.ty.clone(),
            })
            .collect()
    }

    fn bindings(&self) -> Vec<syn::Ident> {
        self.fields
            .iter()
            .enumerate()
            .map(|(index, field)| {
                field
                    .ident
                    .as_ref()
                    .map(|ident| syn::Ident::new(&format!("_{}", ident.unraw()), ident.span()))
                    .unwrap_or_else(|| syn::Ident::new(&format!("_{index}"), Span::call_site()))
            })
            .collect()
    }
}

impl FieldArgs {
    fn key(&self, index: usize) -> String {
        self.ident
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_else(|| index.to_string())
    }
}

impl ErrorAttrs {
    fn parse(attrs: Vec<syn::Attribute>) -> Result<Self> {
        let message = attrs
            .into_iter()
            .find(|attr| attr.path().is_ident("error"))
            .map(|attr| {
                attr.parse_args_with(|input: syn::parse::ParseStream<'_>| {
                    let message = if input.peek(syn::LitStr) {
                        Some(input.parse::<syn::LitStr>()?.value())
                    } else {
                        None
                    };

                    // parse_args_with requires parsing the entire input. At this point
                    // #[error()] can have remaining tokens after the message format string containing
                    // the values to interpolate.
                    let _ = input.parse::<proc_macro2::TokenStream>()?;

                    Ok(message)
                })
                .map_err(darling::Error::from)
            })
            .transpose()
            .map(Option::flatten)?;

        Ok(Self { message })
    }
}
