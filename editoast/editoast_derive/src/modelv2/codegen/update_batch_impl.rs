use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct UpdateBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) identifier: Identifier,
    pub(super) primary_key_column: syn::Ident,
}

impl ToTokens for UpdateBatchImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            row,
            identifier,
            changeset,
            primary_key_column,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let params_per_row = identifier.get_idents().len();
        let filters = identifier.get_diesel_eq_and_fold();

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::UpdateBatchUnchecked<#model, #ty> for #changeset {
                async fn update_batch_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                    C: Default + std::iter::Extend<#model> + Send,
                >(
                    self,
                    conn: &mut crate::modelsv2::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C> {
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    Ok(crate::chunked_for_libpq! {
                        // FIXME: that count is correct for each row, but the maximum buffer size
                        // should be libpq's max MINUS the size of the changeset
                        #params_per_row,
                        ids,
                        C::default(),
                        chunk => {
                            // We have to do it this way because we can't .or_filter() on a boxed update statement
                            let mut query = dsl::#table_name.select(dsl::#primary_key_column).into_boxed();
                            for #id_ident in chunk.into_iter() {
                                query = query.or_filter(#filters);
                            }
                            diesel::update(dsl::#table_name)
                                .filter(dsl::#primary_key_column.eq_any(query))
                                .set(&self)
                                .load_stream::<#row>(conn)
                                .await
                                .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                .await?
                        }
                    })
                }

                async fn update_batch_with_key_unchecked<
                    I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                    C: Default + std::iter::Extend<(#ty, #model)> + Send,
                >(
                    self,
                    conn: &mut crate::modelsv2::DbConnection,
                    ids: I,
                ) -> crate::error::Result<C> {
                    use crate::models::Identifiable;
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    Ok(crate::chunked_for_libpq! {
                        // FIXME: that count is correct for each row, but the maximum buffer size
                        // should be libpq's max MINUS the size of the changeset
                        #params_per_row,
                        ids,
                        C::default(),
                        chunk => {
                            let mut query = dsl::#table_name.select(dsl::#primary_key_column).into_boxed();
                            for #id_ident in chunk.into_iter() {
                                query = query.or_filter(#filters);
                            }
                            diesel::update(dsl::#table_name)
                                .filter(dsl::#primary_key_column.eq_any(query))
                                .set(&self)
                                .load_stream::<#row>(conn)
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
