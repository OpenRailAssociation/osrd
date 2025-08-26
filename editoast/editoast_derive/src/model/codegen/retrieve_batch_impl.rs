use quote::ToTokens;
use quote::quote;

use crate::model::identifier::Identifier;

use super::LibpqChunkedIteration;

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
        let span_name = format!("model:retrieve_batch_unchecked<{model}>");
        let span_name_with_key = format!("model:retrieve_batch_with_key_unchecked<{model}>");

        let retrieve_loop = LibpqChunkedIteration {
            parameters_per_row,
            chunk_size_limit: *chunk_size_limit,
            values_ident: syn::parse_quote! { ids },
            chunk_iteration_ident: syn::parse_quote! { chunk },
            collector: super::LibpqChunkedIterationCollector::Extend {
                collection_init: syn::parse_quote! { C::default() },
            },
            chunk_iteration_body: quote! {
                // Diesel doesn't allow `(col1, col2).eq_any(iterator<(&T, &U)>)` because it imposes restrictions
                // on tuple usage. Doing it this way is the suggested workaround (https://github.com/diesel-rs/diesel/issues/3222#issuecomment-1177433434).
                // eq_any reallocates its argument anyway so the additional cost with this method are the boxing and the diesel wrappers.
                let mut query = dsl::#table_name.into_boxed();
                for #id_ident in chunk.into_iter() {
                    query = query.or_filter(#filters);
                }
                query
                    .select((#(dsl::#columns,)*))
                    .load_stream::<#row>(conn.write().await.deref_mut())
                    .await
                    .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
                    .map_ok(<#model as Model>::from_row)
                    .try_collect::<Vec<_>>()
                    .await
                    .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
            },
        };

        let retrieve_with_key_loop = retrieve_loop.with_iteration_body(quote! {
            let mut query = dsl::#table_name.into_boxed();
            for #id_ident in chunk.into_iter() {
                query = query.or_filter(#filters);
            }
            query
                .select((#(dsl::#columns,)*))
                .load_stream::<#row>(conn.write().await.deref_mut())
                .await
                .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
                .map_ok(|row| {
                    let model = <#model as Model>::from_row(row);
                    (model.get_id(), model)
                })
                .try_collect::<Vec<_>>()
                .await
                .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
        });

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::RetrieveBatchUnchecked<#ty> for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_id))]
                async fn retrieve_batch_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send,
                    C: Default + std::iter::Extend<#model> + Send + std::fmt::Debug,
                >(
                    conn: &mut database::DbConnection,
                    ids: I,
                ) -> std::result::Result<C, Self::Error> {
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok({ #retrieve_loop })
                }

                #[tracing::instrument(name = #span_name_with_key, skip_all, err, fields(query_id))]
                async fn retrieve_batch_with_key_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send,
                    C: Default + std::iter::Extend<(#ty, #model)> + Send + std::fmt::Debug,
                >(
                    conn: &mut database::DbConnection,
                    ids: I,
                ) -> std::result::Result<C, Self::Error> {
                    use crate::prelude::Identifiable;
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok({ #retrieve_with_key_loop })
                }
            }
        });
    }
}
