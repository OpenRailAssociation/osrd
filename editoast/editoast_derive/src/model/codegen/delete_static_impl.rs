use quote::ToTokens;
use quote::quote;

use crate::model::identifier::Identifier;

pub(crate) struct DeleteStaticImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) identifier: Identifier,
    pub(super) error: syn::Path,
}

impl ToTokens for DeleteStaticImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            identifier,
            error,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let id_ref_ident = identifier.get_ref_lvalue();
        let eqs = identifier.get_diesel_eqs();
        let span_name = format!("model:delete_static<{model}>");

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::DeleteStatic<#ty> for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, ret, err, fields(query_id))]
                async fn delete_static(
                    conn: &mut database::DbConnection,
                    #id_ident: #ty,
                ) -> std::result::Result<bool, Self::Error> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use std::ops::DerefMut;
                    use #table_mod::dsl;
                    tracing::Span::current().record("query_id", tracing::field::debug(#id_ref_ident));
                    diesel::delete(dsl::#table_name.#(filter(#eqs)).*)
                        .execute(conn.write().await.deref_mut())
                        .await
                        .map(|n| n == 1)
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))
                }
            }
        });
    }
}
