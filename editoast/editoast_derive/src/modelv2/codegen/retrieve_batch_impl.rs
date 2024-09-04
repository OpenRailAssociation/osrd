use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct RetrieveBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) chunk_size_limit: usize,
    pub(super) row: syn::Ident,
    pub(super) identifier: Identifier,
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
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let params_per_row = identifier.get_idents().len();
        let filters = identifier.get_diesel_eq_and_fold();
        let span_name = format!("model:retrieve_batch_unchecked<{}>", model);
        let span_name_with_key = format!("model:retrieve_batch_with_key_unchecked<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::RetrieveBatchUnchecked<#ty> for #model {
                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_id))]
                async fn retrieve_batch_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                    C: Default + std::iter::Extend<#model> + Send + std::fmt::Debug,
                >(
                    conn: &mut editoast_models::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C> {
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok(crate::chunked_for_libpq! {
                        #params_per_row,
                        #chunk_size_limit,
                        ids,
                        C::default(),
                        chunk => {
                            // Diesel doesn't allow `(col1, col2).eq_any(iterator<(&T, &U)>)` because it imposes restrictions
                            // on tuple usage. Doing it this way is the suggested workaround (https://github.com/diesel-rs/diesel/issues/3222#issuecomment-1177433434).
                            // eq_any reallocates its argument anyway so the additional cost with this method are the boxing and the diesel wrappers.
                            let mut query = dsl::#table_name.into_boxed();
                            for #id_ident in chunk.into_iter() {
                                query = query.or_filter(#filters);
                            }
                            query
                                .load_stream::<#row>(conn.write().await.deref_mut())
                                .await
                                .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                .await?
                        }
                    })
                }

                #[tracing::instrument(name = #span_name_with_key, skip_all, err, fields(query_id))]
                async fn retrieve_batch_with_key_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                    C: Default + std::iter::Extend<(#ty, #model)> + Send + std::fmt::Debug,
                >(
                    conn: &mut editoast_models::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C> {
                    use crate::modelsv2::Identifiable;
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;
                    let ids = ids.into_iter().collect::<Vec<_>>();
                    tracing::Span::current().record("query_ids", tracing::field::debug(&ids));
                    Ok(crate::chunked_for_libpq! {
                        #params_per_row,
                        #chunk_size_limit,
                        ids,
                        C::default(),
                        chunk => {
                            let mut query = dsl::#table_name.into_boxed();
                            for #id_ident in chunk.into_iter() {
                                query = query.or_filter(#filters);
                            }
                            query
                                .load_stream::<#row>(conn.write().await.deref_mut())
                                .await
                                .map(|s| {
                                    s.map_ok(|row| {
                                        let model = <#model as Model>::from_row(row);
                                        (model.get_id(), model)
                                    })
                                    .try_collect::<Vec<_>>()
                                })?
                                .await?
                        }
                    })
                }
            }
        });
    }
}
