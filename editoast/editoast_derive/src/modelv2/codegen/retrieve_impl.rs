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
        let id_ref_ident = identifier.get_ref_lvalue();
        let eqs = identifier.get_diesel_eqs();
        let span_name = format!("model:retrieve<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Retrieve<#ty> for #model {
                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_id))]
                async fn retrieve(
                    conn: &editoast_models::DbConnection,
                    #id_ident: #ty,
                ) -> crate::error::Result<Option<#model>> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    tracing::Span::current().record("query_id", tracing::field::debug(#id_ref_ident));
                    dsl::#table_name
                        .#(filter(#eqs)).*
                        .first::<#row>(conn.write().await.deref_mut())
                        .await
                        .map(Into::into)
                        .optional()
                        .map_err(Into::into)
                }
            }
        });
    }
}
