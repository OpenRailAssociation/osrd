use quote::quote;
use quote::ToTokens;

pub(crate) struct CountImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
}

impl ToTokens for CountImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, table_mod } = self;
        let span_name = format!("model:list<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::prelude::Count for #model {
                #[tracing::instrument(name = #span_name, skip_all, ret, err)]
                async fn count(
                    conn: &'async_trait mut crate::modelsv2::DbConnection,
                    settings: crate::modelsv2::prelude::SelectionSettings<Self>,
                ) -> crate::error::Result<u64> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;

                    let mut query = #table_mod::table.select(diesel::dsl::count_star()).into_boxed();

                    for filter_fun in settings.filters {
                        let crate::modelsv2::prelude::FilterSetting(filter) = (*filter_fun)();
                        query = query.filter(filter);
                    }

                    if settings.paginate_counting {
                        if let Some(limit) = settings.limit {
                            query = query.limit(limit);
                        }

                        if let Some(offset) = settings.offset {
                            query = query.offset(offset);
                        }
                    }

                    Ok(query.get_result::<i64>(conn).await? as u64)
                }
            }

        });
    }
}
