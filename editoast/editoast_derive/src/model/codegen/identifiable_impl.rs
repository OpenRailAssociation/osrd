use quote::ToTokens;
use quote::quote;

pub(crate) struct IdentifiableImpl {
    pub(super) model: syn::Ident,
    pub(super) ty: syn::Type,
    pub(super) fields: Vec<syn::Ident>,
}

impl ToTokens for IdentifiableImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, ty, fields } = self;
        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::Identifiable<#ty> for #model {
                fn get_id(&self) -> #ty {
                    (#(self.#fields.clone()),*)
                }
            }
        });
    }
}
