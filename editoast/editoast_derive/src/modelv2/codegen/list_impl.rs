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

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::prelude::List for #model {
                async fn list_and_count(
                    conn: &'async_trait mut crate::modelsv2::DbConnection,
                    settings: crate::modelsv2::prelude::SelectionSettings<Self>,
                ) -> crate::error::Result<(Vec<Self>, u64)> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;

                    let mut query = #table_mod::table.into_boxed();

                    for crate::modelsv2::prelude::FilterSetting(filter) in settings.filters {
                        query = query.filter(filter);
                    }

                    for crate::modelsv2::prelude::SortSetting(asc_desc) in settings.sorts {
                        query = query.order_by(asc_desc);
                    }

                    let query = crate::modelsv2::prelude::ListAndCountQuery {
                        query,
                        limit: settings.limit,
                        offset: settings.offset,
                    };

                    let results: crate::modelsv2::prelude::ListAndCountIntermediateContainer<#model> =
                        query
                            .load_stream::<(i64, Option<#row>)>(conn)
                            .await?
                            .try_collect()
                            .await?;

                    Ok(results.into_result())
                }

                async fn list(
                    conn: &'async_trait mut crate::modelsv2::DbConnection,
                    settings: crate::modelsv2::prelude::SelectionSettings<Self>,
                ) -> crate::error::Result<Vec<Self>> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;

                    let mut query = #table_mod::table.into_boxed();

                    for crate::modelsv2::prelude::FilterSetting(filter) in settings.filters {
                        query = query.filter(filter);
                    }

                    for crate::modelsv2::prelude::SortSetting(asc_desc) in settings.sorts {
                        query = query.order_by(asc_desc);
                    }

                    if let Some(limit) = settings.limit {
                        query = query.limit(limit);
                    }

                    if let Some(offset) = settings.offset {
                        query = query.offset(offset);
                    }

                    let results: Vec<#model> = query
                        .load_stream::<#row>(conn)
                        .await?
                        .map_ok(<#model as crate::modelsv2::prelude::Model>::from_row)
                        .try_collect()
                        .await?;

                    Ok(results)
                }
            }

        });
    }
}
