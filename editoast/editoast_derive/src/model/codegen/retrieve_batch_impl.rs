use quote::ToTokens;
use quote::quote;

use crate::model::identifier::Identifier;

pub(crate) struct RetrieveBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) chunk_size_limit: usize,
    pub(super) row: syn::Ident,
    pub(super) identifier: Identifier,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
}

impl ToTokens for RetrieveBatchImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            chunk_size_limit,
            row,
            identifier,
            columns,
            error,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let parameters_per_row = identifier.get_idents().len();
        let filters = identifier.get_diesel_eq_and_fold();
        let span_name = format!("model:retrieve_stream<{model}>");

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::RetrieveBatchUnchecked<#ty> for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_ids))]
                async fn retrieve_stream<
                    I: std::iter::IntoIterator<Item = #ty> + Send,
                >(
                    conn: &mut database::DbConnection,
                    ids: I,
                ) -> std::result::Result<impl futures::TryStream<Ok = (#ty, Self), Error = Self::Error>, Self::Error> {
                    use crate::prelude::Identifiable;
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::{StreamExt, TryStreamExt};
                    use std::ops::DerefMut;

                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));

                    const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
                    // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
                    const ASYNC_SUBDIVISION: usize = 2_usize;
                    const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / #parameters_per_row;

                    let chunks = ids.chunks(CHUNK_SIZE.min(#chunk_size_limit));

                    let results = futures::stream::iter(chunks).fold(vec![], async |mut results, chunk| {
                        let mut query = dsl::#table_name.into_boxed();
                        for #id_ident in chunk.into_iter() {
                            query = query.or_filter(#filters);
                        }

                        let stream = query
                                .select((#(dsl::#columns,)*))
                                .load_stream::<#row>(conn.write().await.deref_mut())
                                .await;

                        let inner = match stream {
                            Ok(inner) => inner,
                            Err(e) => todo!(),
                        };

                        let st = inner
                            .map_ok(|row| {
                                let model = <#model as crate::prelude::Model>::from_row(row);
                                (model.get_id(), model)
                            })
                            .map_err(|e| Self::Error::from(editoast_models::Error::from(e)));

                        results.push(st);
                        results
                    }).await;

                    Ok(futures::stream::select_all(results))
                }
            }
        });
    }
}
