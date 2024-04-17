use super::Identifier;
use darling::{
    ast,
    util::{self, PathList},
    FromDeriveInput, FromField, FromMeta,
};
use proc_macro2::Span;

#[derive(FromDeriveInput, Debug)]
#[darling(
    attributes(model),
    forward_attrs(allow, doc, cfg),
    supports(struct_named)
)]
pub struct ModelArgs {
    pub table: syn::Path,
    #[darling(default)]
    pub row: GeneratedTypeArgs,
    #[darling(default)]
    pub changeset: GeneratedTypeArgs,
    #[darling(multiple, rename = "identifier")]
    pub identifiers: Vec<Identifier>,
    #[darling(default)]
    pub preferred: Option<Identifier>,
    pub data: ast::Data<util::Ignored, ModelFieldArgs>,
}

#[derive(FromMeta, Default, Debug, PartialEq)]
pub struct GeneratedTypeArgs {
    #[darling(default)]
    pub type_name: Option<String>,
    #[darling(default)]
    pub derive: PathList,
    #[darling(default)]
    pub public: bool,
}

#[derive(FromField, Debug)]
#[darling(attributes(model), forward_attrs(allow, doc, cfg))]
pub struct ModelFieldArgs {
    pub ident: Option<syn::Ident>,
    pub ty: syn::Type,
    #[darling(default)]
    pub builder_fn: Option<syn::Ident>,
    #[darling(default)]
    pub column: Option<String>,
    #[darling(default)]
    pub builder_skip: bool,
    #[darling(default)]
    pub identifier: bool,
    #[darling(default)]
    pub preferred: bool,
    #[darling(default)]
    pub primary: bool,
    #[darling(default)]
    pub json: bool,
    #[darling(default)]
    pub geo: bool,
    #[darling(default)]
    pub to_string: bool,
    #[darling(default)]
    pub to_enum: bool,
    #[darling(default)]
    pub remote: Option<syn::Type>,
}

impl GeneratedTypeArgs {
    pub fn ident(&self) -> syn::Ident {
        syn::Ident::new(self.type_name.as_ref().unwrap(), Span::call_site())
    }
}
