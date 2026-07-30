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
#[darling(forward_attrs(from, source, view_error))]
struct FieldArgs {
    ident: Option<syn::Ident>,
    ty: syn::Type,
    #[darling(with = FieldAttrs::parse)]
    attrs: FieldAttrs,
}

#[derive(Debug)]
struct ErrorAttrs {
    thiserror: ThisErrorAttr,
}

/// Parses `thiserror`'s `error` attribute on a type or enum variant
///
/// Supports `#[error("format_string", interpolated_values*)]` and `#[error(transparent)]` forms.
/// Interpolated values are ignored.
#[derive(Debug, Default)]
enum ThisErrorAttr {
    Message(String),
    Transparent,
    #[default]
    None,
}

#[derive(Debug)]
struct FieldAttrs {
    source: bool,
    view_error: bool,
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
            attrs: ErrorAttrs { thiserror },
            name,
            context: context_on_type,
            args: TypeArgs { status },
        } = self;
        let label = name.unwrap_or_else(|| ident.to_string());
        let mut view_error_impl = ViewErrorImpl::new(ident, label.clone());

        match data {
            ast::Data::Struct(fields) => {
                let pattern = fields.pattern(None);
                if let Some(ForwardedField { binding, ty }) = fields.forwarded_view_error() {
                    view_error_impl.forward_view_error(pattern, binding, ty);
                } else {
                    let context_entries = if context_on_type && !thiserror.is_transparent() {
                        fields.context()
                    } else {
                        Vec::new()
                    };
                    let openapi_context = if context_on_type && !thiserror.is_transparent() {
                        fields.openapi_context_spec()
                    } else {
                        Vec::new()
                    };
                    view_error_impl.push_error(
                        pattern,
                        Context {
                            entries: context_entries,
                        },
                        OpenApiResponse {
                            label,
                            sub_label: None,
                            status,
                            message_template: thiserror.message().cloned(),
                            context: openapi_context,
                        },
                    );
                }
            }
            ast::Data::Enum(variants) => {
                for variant in variants {
                    let VariantArgs {
                        ident: variant_ident,
                        fields,
                        attrs: ErrorAttrs { thiserror },
                        status,
                        context: context_on_variant,
                    } = variant;
                    let sub_label = variant_ident.to_string();
                    let pattern = fields.pattern(Some(&variant_ident));
                    if let Some(ForwardedField { binding, ty }) = fields.forwarded_view_error() {
                        view_error_impl.forward_view_error(pattern, binding, ty);
                    } else {
                        let context_entries = if (context_on_type || context_on_variant)
                            && !thiserror.is_transparent()
                        {
                            fields.context()
                        } else {
                            Vec::new()
                        };
                        let openapi_context = if (context_on_type || context_on_variant)
                            && !thiserror.is_transparent()
                        {
                            fields.openapi_context_spec()
                        } else {
                            Vec::new()
                        };
                        view_error_impl.push_error(
                            pattern,
                            Context {
                                entries: context_entries,
                            },
                            OpenApiResponse {
                                label: label.clone(),
                                sub_label: Some(sub_label),
                                status,
                                message_template: thiserror.message().cloned(),
                                context: openapi_context,
                            },
                        );
                    }
                }
            }
        }

        Ok(Codegen(view_error_impl))
    }
}

// It's convenient to implement extensions on `ast::Fields` as it is used for both
// structs and enum variants.
trait AstFieldsExt {
    fn pattern(&self, self_variant: Option<&syn::Ident>) -> syn::Pat;
    fn context(&self) -> Vec<ContextEntry>;
    fn openapi_context_spec(&self) -> Vec<ContextEntrySpec>;
    fn forwarded_view_error(&self) -> Option<ForwardedField>;
}

struct ForwardedField {
    binding: syn::Ident,
    ty: syn::Type,
}

impl AstFieldsExt for ast::Fields<FieldArgs> {
    fn pattern(&self, self_variant: Option<&syn::Ident>) -> syn::Pat {
        let bindings = self
            .fields
            .iter()
            .enumerate()
            .map(|(index, field)| field.binding(index));
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
            .enumerate()
            .filter(|(_, field)| !field.is_source())
            .map(|(index, field)| ContextEntry {
                key: field.key(index),
                binding: field.binding(index),
            })
            .collect()
    }

    fn openapi_context_spec(&self) -> Vec<ContextEntrySpec> {
        self.fields
            .iter()
            .enumerate()
            .filter(|(_, field)| !field.is_source())
            .map(|(index, field)| ContextEntrySpec {
                key: field.key(index),
                ty: field.ty.clone(),
            })
            .collect()
    }

    fn forwarded_view_error(&self) -> Option<ForwardedField> {
        let (index, field) = self
            .fields
            .iter()
            .enumerate()
            .find(|(_, field)| field.attrs.view_error)?;
        // NOTE: an error forwarding another view error can have additional fields in the
        // Rust type but these will be ignored as the embedded view error will be substituted.
        Some(ForwardedField {
            binding: field.binding(index),
            ty: field.ty.clone(),
        })
    }
}

impl FieldArgs {
    fn binding(&self, index: usize) -> syn::Ident {
        self.ident
            .as_ref()
            .map(|ident| syn::Ident::new(&format!("_{}", ident.unraw()), ident.span()))
            .unwrap_or_else(|| syn::Ident::new(&format!("_{index}"), Span::call_site()))
    }

    fn is_source(&self) -> bool {
        self.attrs.source
            || self
                .ident
                .as_ref()
                .is_some_and(|ident| ident.unraw() == "source")
    }

    fn key(&self, index: usize) -> String {
        self.ident
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_else(|| index.to_string())
    }
}

impl ErrorAttrs {
    fn parse(attrs: Vec<syn::Attribute>) -> Result<Self> {
        reject_unsupported_from(&attrs)?;
        Ok(Self {
            thiserror: ThisErrorAttr::parse(attrs)?,
        })
    }
}

impl ThisErrorAttr {
    fn is_transparent(&self) -> bool {
        matches!(self, Self::Transparent)
    }

    fn message(&self) -> Option<&String> {
        match self {
            Self::Message(message) => Some(message),
            Self::Transparent | Self::None => None,
        }
    }

    fn parse(attrs: Vec<syn::Attribute>) -> Result<Self> {
        Ok(attrs
            .iter()
            .find(|attr| attr.path().is_ident("error"))
            .map(|attr| {
                attr.parse_args_with(|input: syn::parse::ParseStream<'_>| {
                    let error = if input.peek(syn::LitStr) {
                        ThisErrorAttr::Message(input.parse::<syn::LitStr>()?.value())
                    } else if input.peek(syn::Ident) {
                        let ident = input.parse::<syn::Ident>()?;
                        if ident == "transparent" {
                            ThisErrorAttr::Transparent
                        } else {
                            ThisErrorAttr::None
                        }
                    } else {
                        ThisErrorAttr::None
                    };

                    // parse_args_with requires parsing the entire input. At this point
                    // #[error()] can have remaining tokens after the message format string containing
                    // the values to interpolate.
                    let _ = input.parse::<proc_macro2::TokenStream>()?;

                    Ok(error)
                })
                .map_err(darling::Error::from)
            })
            .transpose()?
            .unwrap_or_default())
    }
}

impl FieldAttrs {
    fn parse(attrs: Vec<syn::Attribute>) -> Result<Self> {
        reject_unsupported_from(&attrs)?;

        let source = attrs.iter().any(|attr| {
            matches!(&attr.meta, syn::Meta::Path(_))
                && (attr.path().is_ident("from") || attr.path().is_ident("source"))
        });
        let view_error =
            if let Some(attr) = attrs.iter().find(|attr| attr.path().is_ident("view_error")) {
                if !matches!(&attr.meta, syn::Meta::Path(_)) {
                    return Err(darling::Error::custom(
                        "`#[view_error]` does not accept arguments on fields",
                    )
                    .with_span(attr));
                }
                true
            } else {
                false
            };

        Ok(Self { source, view_error })
    }
}

fn reject_unsupported_from(attrs: &[syn::Attribute]) -> Result<()> {
    for attr in attrs.iter().filter(|attr| attr.path().is_ident("from")) {
        let Ok(mode) = attr.parse_args::<syn::Ident>() else {
            continue;
        };
        if mode == "skip" || mode == "ignore" {
            return Err(darling::Error::custom(format!(
                "`#[from({mode})]` is not supported by `ViewError`"
            ))
            .with_span(attr));
        }
    }

    Ok(())
}
