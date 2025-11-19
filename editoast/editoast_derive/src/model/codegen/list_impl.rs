use quote::ToTokens;
use quote::quote;

pub(crate) struct ListImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
}

impl ToTokens for ListImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            row,
            columns,
            error,
        } = self;
        let span_name = format!("model:list_stream<{model}>");

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::List for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err, fields(
                    nb_filters = settings.filters.len(),
                    nb_sorts = settings.sorts.len(),
                    paginate_counting = settings.paginate_counting,
                    limit,
                    offset,
                ))]
                async fn list_stream(
                    conn: &mut database::DbConnection,
                    settings: crate::prelude::SelectionSettings<Self>,
                ) -> std::result::Result<impl futures::TryStream<Ok = Self, Error = Self::Error>, Self::Error> {
                    use diesel::QueryDsl;
                    use diesel_async::RunQueryDsl;
                    use futures_util::{StreamExt, TryStreamExt};
                    use #table_mod::dsl;
                    use std::ops::DerefMut;

                    let mut query = #table_mod::table.into_boxed();

                    for filter_fun in settings.filters {
                        let crate::prelude::FilterSetting(filter) = (*filter_fun)();
                        query = query.filter(filter);
                    }

                    for sort_fun in settings.sorts {
                        let crate::prelude::SortSetting(sort) = (*sort_fun)();
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

                    let stream = query
                        .select((#(dsl::#columns,)*))
                        .load_stream::<#row>(conn.write().await.deref_mut())
                        .await;

                    let inner = match stream {
                        Ok(inner) => inner,
                        Err(e) => return Err(Self::Error::from(editoast_models::Error::from(e))),
                    };

                    Ok(inner
                        .map_ok(<#model as crate::prelude::Model>::from_row)
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e))))
                }
            }
        });
    }
}
