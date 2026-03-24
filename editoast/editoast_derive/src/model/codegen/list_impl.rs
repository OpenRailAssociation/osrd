use quote::ToTokens;
use quote::quote;

pub(crate) struct ListImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) primary_key: syn::Ident,
    pub(super) row: syn::Ident,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
}

impl ToTokens for ListImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            primary_key,
            row,
            columns,
            error,
        } = self;
        let span_name = format!("model:list<{model}>");

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
                async fn list(
                    conn: &mut database::DbConnection,
                    settings: crate::prelude::SelectionSettings<Self>,
                ) -> std::result::Result<Vec<Self>, Self::Error> {
                    use diesel::ExpressionMethods as _;
                    use diesel::NullableExpressionMethods as _;
                    use diesel::QueryDsl as _;
                    use diesel_async::RunQueryDsl as _;
                    use futures_util::TryStreamExt as _;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;

                    let mut query = #table_mod::table.into_boxed();

                    for filter_fun in &settings.filters {
                        let crate::prelude::FilterSetting(filter) = (*filter_fun)();
                        query = query.filter(filter);
                    }

                    for sort_fun in &settings.sorts {
                        let crate::prelude::SortSetting(sort) = (*sort_fun)();
                        query = query.order_by(sort);
                    }

                    if settings.sorts.is_empty() {
                        query = query.order_by(dsl::#primary_key.asc());
                    }

                    // Avoids OFFSET: instead of scanning past offset
                    // rows, use a subquery to skip directly to the
                    // right pk and let the index find the first row faster.
                    //
                    // Makes PostgreSQL waste less time on IO skipping rows. More
                    // info: https://github.com/OpenRailAssociation/osrd/issues/15852
                    //
                    // We should eventually change the API to expect cursor pagination
                    // or streaming when applicable.
                    //
                    // Generated SQL:
                    //   SELECT cols FROM table
                    //   WHERE <filters>
                    //     AND pk >= (SELECT pk FROM table WHERE <filters>
                    //                ORDER BY pk ASC LIMIT 1 OFFSET <offset>)
                    //   ORDER BY pk ASC
                    //   LIMIT <limit>
                    if let Some(offset) = settings.offset
                        && offset > 0
                    {
                        tracing::Span::current().record("offset", offset);

                        let mut first_pk_query = #table_mod::table.into_boxed();
                        for filter_fun in &settings.filters {
                            let crate::prelude::FilterSetting(filter) = (*filter_fun)();
                            first_pk_query = first_pk_query.filter(filter);
                        }

                        for sort_fun in &settings.sorts {
                            let crate::prelude::SortSetting(sort) = (*sort_fun)();
                            first_pk_query = first_pk_query.order_by(sort);
                        }

                        if settings.sorts.is_empty() {
                            first_pk_query = first_pk_query.order_by(dsl::#primary_key.asc());
                        }

                        let first_pk = first_pk_query
                            .select(dsl::#primary_key)
                            .offset(offset)
                            .single_value();

                        query = query.filter(dsl::#primary_key.nullable().ge(first_pk));
                    }

                    if let Some(limit) = settings.limit {
                        tracing::Span::current().record("limit", limit);
                        query = query.limit(limit);
                    }

                    let stream = query
                        .select((#(dsl::#columns,)*))
                        .load_stream::<#row>(conn.write().await.deref_mut())
                        .await
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))?;
                    futures_util::TryStreamExt::map_ok(stream, <#model as crate::prelude::Model>::from_row)
                        .try_collect::<Vec<_>>()
                        .await
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))
                }
            }

        });
    }
}
