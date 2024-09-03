use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct ExistsImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) identifier: Identifier,
}

impl ToTokens for ExistsImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            identifier,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let id_ref_ident = identifier.get_ref_lvalue();
        let eqs = identifier.get_diesel_eqs();
        let span_name = format!("model:exists<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Exists<#ty> for #model {
                #[tracing::instrument(name = #span_name, skip_all, ret, err, fields(query_id))]
                async fn exists(
                    conn: &editoast_models::DbConnection,
                    #id_ident: #ty,
                ) -> crate::error::Result<bool> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use std::ops::DerefMut;
                    use #table_mod::dsl;
                    tracing::Span::current().record("query_id", tracing::field::debug(#id_ref_ident));
                    diesel::select(diesel::dsl::exists(dsl::#table_name.#(filter(#eqs)).*))
                        .get_result(conn.write().await.deref_mut())
                        .await
                        .map_err(Into::into)
                }
            }
        });
    }
}
