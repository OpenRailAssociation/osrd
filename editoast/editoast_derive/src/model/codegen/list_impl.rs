use quote::quote;
use quote::ToTokens;

pub(crate) struct ListImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
}

impl ToTokens for ListImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            row,
        } = self;
        let span_name = format!("model:list<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::models::prelude::List for #model {
                #[tracing::instrument(name = #span_name, skip_all, err, fields(
                    nb_filters = settings.filters.len(),
                    nb_sorts = settings.sorts.len(),
                    paginate_counting = settings.paginate_counting,
                    limit,
                    offset,
                ))]
                async fn list(
                    conn: &'async_trait mut editoast_models::DbConnection,
                    settings: crate::models::prelude::SelectionSettings<Self>,
                ) -> crate::error::Result<Vec<Self>> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;

                    let mut query = #table_mod::table.into_boxed();

                    for filter_fun in settings.filters {
                        let crate::models::prelude::FilterSetting(filter) = (*filter_fun)();
                        query = query.filter(filter);
                    }

                    for sort_fun in settings.sorts {
                        let crate::models::prelude::SortSetting(sort) = (*sort_fun)();
                        query = query.order_by(sort);
                    }

                    if let Some(limit) = settings.limit {
                        tracing::Span::current().record("limit", limit);
                        query = query.limit(limit);
                    }

                    if let Some(offset) = settings.offset {
                        tracing::Span::current().record("offset", offset);
                        query = query.offset(offset);
                    }

                    let results: Vec<#model> = query
                        .load_stream::<#row>(conn.write().await.deref_mut())
                        .await?
                        .map_ok(<#model as crate::models::prelude::Model>::from_row)
                        .try_collect()
                        .await?;

                    Ok(results)
                }
            }

        });
    }
}
