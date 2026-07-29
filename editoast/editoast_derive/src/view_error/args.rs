use darling::FromDeriveInput;
use darling::FromField;
use darling::FromMeta;
use darling::FromVariant;
use darling::Result;
use darling::ast;

use crate::view_error::codegen::Codegen;

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

#[derive(Debug, Clone, FromMeta)]
pub(super) struct StatusCodeArg(pub(super) syn::Ident);

impl Default for StatusCodeArg {
    fn default() -> Self {
        Self(syn::parse_quote! { INTERNAL_SERVER_ERROR }) // 500
    }
}

impl Args {
    pub(super) fn parse(self) -> Result<Codegen> {
        let view_error_impl = todo!();
        Ok(Codegen(view_error_impl))
    }
}
