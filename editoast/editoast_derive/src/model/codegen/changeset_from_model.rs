use crate::model::utils::np;
use crate::model::ModelField;
use quote::quote;
use quote::ToTokens;
use syn::parse_quote;

pub(crate) struct ChangesetFromModelImpl {
    pub(super) model: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) fields: Vec<ModelField>,
}

impl ToTokens for ChangesetFromModelImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            changeset,
            fields,
        } = self;
        let np!(field, value): np!(vec2) = fields
            .iter()
            .map(|field| {
                let ident = &field.ident;
                let expr = field.into_transformed(parse_quote! { model.#ident });
                (ident, expr)
            })
            .unzip();
        tokens.extend(quote! {
            #[automatically_derived]
            impl From<#model> for #changeset {
                fn from(model: #model) -> Self {
                    Self {
                        #( #field: Some(#value) ),*
                    }
                }
            }
        });
    }
}
