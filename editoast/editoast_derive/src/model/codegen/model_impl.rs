use quote::ToTokens;
use quote::quote;

pub(crate) struct ModelImpl {
    pub(super) model: syn::Ident,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) table: syn::Path,
}

impl ToTokens for ModelImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            row,
            changeset,
            table,
        } = self;
        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::Model for #model {
                type Row = #row;
                type Changeset = #changeset;
                type Table = #table::table;
            }
        });
    }
}
