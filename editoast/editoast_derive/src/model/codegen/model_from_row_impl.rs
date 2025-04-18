use crate::model::ModelField;
use crate::model::utils::np;
use quote::ToTokens;
use quote::quote;
use syn::parse_quote;

pub(crate) struct ModelFromRowImpl {
    pub(super) model: syn::Ident,
    pub(super) row: syn::Ident,
    pub(super) fields: Vec<ModelField>,
}

impl ToTokens for ModelFromRowImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, row, fields } = self;
        let np!(field, value): np!(vec2) = fields
            .iter()
            .map(|field| {
                let ident = &field.ident;
                let expr = field.from_transformed(parse_quote! { row.#ident });
                (ident, expr)
            })
            .unzip();
        tokens.extend(quote! {
            #[automatically_derived]
            impl From<#row> for #model {
                fn from(row: #row) -> Self {
                    Self {
                        #( #field: #value ),*
                    }
                }
            }
        });
    }
}
