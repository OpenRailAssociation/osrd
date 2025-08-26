use quote::ToTokens;
use quote::quote;

pub(crate) struct CountImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) error: syn::Path,
}

impl ToTokens for CountImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            error,
        } = self;
        let span_name = format!("model:count<{model}>");

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::Count for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, ret, err, fields(
                    nb_filters = settings.filters.len(),
                    paginate_counting = settings.paginate_counting,
                    limit,
                    offset,
                ))]
                async fn count(
                    conn: &mut database::DbConnection,
                    settings: crate::prelude::SelectionSettings<Self>,
                ) -> std::result::Result<u64, Self::Error> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    use std::ops::DerefMut;

                    let mut query = #table_mod::table.select(diesel::dsl::count_star()).into_boxed();

                    for filter_fun in settings.filters {
                        let crate::prelude::FilterSetting(filter) = (*filter_fun)();
                        query = query.filter(filter);
                    }

                    if settings.paginate_counting {
                        if let Some(limit) = settings.limit {
                            tracing::Span::current().record("limit", limit);
                            query = query.limit(limit);
                        }

                        if let Some(offset) = settings.offset {
                            tracing::Span::current().record("offset", offset);
                            query = query.offset(offset);
                        }
                    }

                    query.get_result::<i64>(conn.write().await.deref_mut())
                        .await
                        .map(|count| count as u64)
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))
                }
            }

        });
    }
}
