use quote::quote;
use quote::ToTokens;

pub(crate) struct DeleteImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) primary_key: syn::Ident,
}

impl ToTokens for DeleteImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            primary_key,
        } = self;
        let span_name = format!("model:delete<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Delete for #model {
                #[tracing::instrument(name = #span_name, skip_all, ret, err, fields(query_id = ?self.#primary_key))]
                async fn delete(
                    &self,
                    conn: &mut editoast_models::DbConnection,
                ) -> crate::error::Result<bool> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    let id = self.#primary_key;
                    diesel::delete(#table_mod::table.find(id))
                        .execute(conn.write().await.deref_mut())
                        .await
                        .map(|n| n == 1)
                        .map_err(Into::into)
                }
            }
        });
    }
}
