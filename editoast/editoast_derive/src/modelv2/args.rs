#![allow(clippy::manual_unwrap_or_default)]

use super::RawIdentifier;
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
pub(super) struct ModelArgs {
    pub(super) table: syn::Path,
    #[darling(default)]
    pub(super) row: GeneratedTypeArgs,
    #[darling(default)]
    pub(super) changeset: GeneratedTypeArgs,
    #[darling(multiple, rename = "identifier")]
    pub(super) identifiers: Vec<RawIdentifier>,
    #[darling(default)]
    pub(super) preferred: Option<RawIdentifier>,
    pub(super) data: ast::Data<util::Ignored, ModelFieldArgs>,
}

#[derive(FromMeta, Default, Debug, PartialEq)]
pub(super) struct GeneratedTypeArgs {
    #[darling(default)]
    pub(super) type_name: Option<String>,
    #[darling(default)]
    pub(super) derive: PathList,
    #[darling(default)]
    pub(super) public: bool,
}

#[derive(FromField, Debug)]
#[darling(attributes(model), forward_attrs(allow, doc, cfg))]
pub(super) struct ModelFieldArgs {
    pub(super) ident: Option<syn::Ident>,
    pub(super) ty: syn::Type,
    #[darling(default)]
    pub(super) builder_fn: Option<syn::Ident>,
    #[darling(default)]
    pub(super) column: Option<syn::Path>,
    #[darling(default)]
    pub(super) builder_skip: bool,
    #[darling(default)]
    pub(super) identifier: bool,
    #[darling(default)]
    pub(super) preferred: bool,
    #[darling(default)]
    pub(super) primary: bool,
    #[darling(default)]
    pub(super) json: bool,
    #[darling(default)]
    pub(super) geo: bool,
    #[darling(default)]
    pub(super) to_string: bool,
    #[darling(default)]
    pub(super) to_enum: bool,
    #[darling(default)]
    pub(super) remote: Option<syn::Type>,
}

impl GeneratedTypeArgs {
    pub(super) fn ident(&self) -> syn::Ident {
        syn::Ident::new(self.type_name.as_ref().unwrap(), Span::call_site())
    }

    pub(super) fn visibility(&self) -> syn::Visibility {
        if self.public {
            syn::Visibility::Public(Default::default())
        } else {
            syn::Visibility::Inherited
        }
    }
}
