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

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Delete for #model {
                async fn delete(
                    &self,
                    conn: &mut diesel_async::AsyncPgConnection,
                ) -> crate::error::Result<bool> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    let id = self.#primary_key;
                    diesel::delete(#table_mod::table.find(id))
                        .execute(conn)
                        .await
                        .map(|n| n == 1)
                        .map_err(Into::into)
                }
            }
        });
    }
}
