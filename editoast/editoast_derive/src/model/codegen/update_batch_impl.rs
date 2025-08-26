use quote::ToTokens;
use quote::quote;

use crate::model::identifier::Identifier;

use super::LibpqChunkedIteration;
use super::LibpqChunkedIterationCollector;

pub(crate) struct UpdateBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) chunk_size_limit: usize,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) identifier: Identifier,
    pub(super) primary_key_column: syn::Ident,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
}

impl ToTokens for UpdateBatchImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            chunk_size_limit,
            row,
            identifier,
            changeset,
            primary_key_column,
            columns,
            error,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let parameters_per_row = identifier.get_idents().len();
        let filters = identifier.get_diesel_eq_and_fold();
        let span_name = format!("model:update_batch_unchecked<{model}>");
        let span_name_with_key = format!("model:update_batch_unchecked<{model}>");

        let update_loop = LibpqChunkedIteration {
            // FIXME: that count is correct for each row, but the maximum buffer size
            // should be libpq's max MINUS the size of the changeset
            parameters_per_row,
            chunk_size_limit: *chunk_size_limit,
            values_ident: syn::parse_quote! { ids },
            chunk_iteration_ident: syn::parse_quote! { chunk },
            collector: LibpqChunkedIterationCollector::Extend {
                collection_init: syn::parse_quote! { C::default() },
            },
            chunk_iteration_body: quote! {
                // We have to do it this way because we can't .or_filter() on a boxed update statement
                let mut query = dsl::#table_name.select(dsl::#primary_key_column).into_boxed();
                for #id_ident in chunk.into_iter() {
                    query = query.or_filter(#filters);
                }
                diesel::update(dsl::#table_name)
                    .filter(dsl::#primary_key_column.eq_any(query))
                    .set(&self)
                    .returning((#(dsl::#columns,)*))
                    .load_stream::<#row>(conn.write().await.deref_mut())
                    .await
                    .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
                    .map_ok(<#model as Model>::from_row)
                    .try_collect::<Vec<_>>()
                    .await
                    .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?
            },
        };

        let update_with_key_loop = update_loop.with_iteration_body(quote! {
            let mut query = dsl::#table_name.select(dsl::#primary_key_column).into_boxed();
            for #id_ident in chunk.into_iter() {
                query = query.or_filter(#filters);
            }
            diesel::update(dsl::#table_name)
                .filter(dsl::#primary_key_column.eq_any(query))
                .set(&self)
                .returning((#(dsl::#columns,)*))
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
            impl crate::prelude::UpdateBatchUnchecked<#model, #ty> for #changeset {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_ids))]
                async fn update_batch_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send,
                    C: Default + std::iter::Extend<#model> + Send + std::fmt::Debug,
                >(
                    self,
                    conn: &mut database::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C, Self::Error> {
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt as _;
                    use futures_util::TryFutureExt as _;
                    use std::ops::DerefMut;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok({ #update_loop })
                }

                #[tracing::instrument(name = #span_name_with_key, skip_all, err, fields(query_ids))]
                async fn update_batch_with_key_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send,
                    C: Default + std::iter::Extend<(#ty, #model)> + Send,
                >(
                    self,
                    conn: &mut database::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C, Self::Error> {
                    use crate::prelude::Identifiable;
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt as _;
                    use futures_util::TryFutureExt as _;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok({ #update_with_key_loop })
                }
            }
        });
    }
}
