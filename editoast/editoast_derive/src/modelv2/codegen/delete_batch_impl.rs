use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::TypedIdentifier;

pub(crate) struct DeleteBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) identifier: TypedIdentifier,
}

impl ToTokens for DeleteBatchImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            identifier,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let params_per_row = identifier.get_idents().len();
        let filters = identifier.get_diesel_eq_and_fold();

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::DeleteBatch<#ty> for #model {
                async fn delete_batch<I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait>(
                    conn: &mut diesel_async::AsyncPgConnection,
                    ids: I,
                ) -> crate::error::Result<usize> {
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    let counts = crate::chunked_for_libpq! {
                        #params_per_row,
                        ids,
                        chunk => {
                            let mut query = diesel::delete(dsl::#table_name).into_boxed();
                            for #id_ident in chunk.into_iter() {
                                query = query.or_filter(#filters);
                            }
                            query.execute(conn).await?
                        }
                    };
                    Ok(counts.into_iter().sum())
                }
            }
        });
    }
}
