use super::np;
use quote::quote;
use quote::ToTokens;

pub(crate) struct ModelFieldsImplBlock {
    pub(super) model: syn::Ident,
    pub(super) fields: Vec<ModelFieldDecl>,
}

pub(crate) struct ModelFieldDecl {
    pub(super) name: syn::Ident,
    pub(super) ty: syn::Type,
    pub(super) column: syn::Path,
}

impl ToTokens for ModelFieldsImplBlock {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, fields } = self;
        let np!(name, ty, column): np!(vec3) = fields
            .iter()
            .map(|field| {
                let ModelFieldDecl { name, ty, column } = field;
                np!(name, ty, column)
            })
            .unzip();
        tokens.extend(quote! {
            paste::paste! {
                impl #model {
                    #(pub const [< #name:snake:upper >]: crate::models::ModelField<#model, #ty, #column> = crate::models::ModelField::new();)*
                }
            }
        });
    }
}
