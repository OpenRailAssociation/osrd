use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct RetrieveImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) identifier: Identifier,
}

impl ToTokens for RetrieveImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            row,
            identifier,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let eqs = identifier.get_diesel_eqs();

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Retrieve<#ty> for #model {
                async fn retrieve(
                    conn: &mut crate::modelsv2::Connection,
                    #id_ident: #ty,
                ) -> crate::error::Result<Option<#model>> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    dsl::#table_name
                        .#(filter(#eqs)).*
                        .first::<#row>(conn)
                        .await
                        .map(Into::into)
                        .optional()
                        .map_err(Into::into)
                }
            }
        });
    }
}
