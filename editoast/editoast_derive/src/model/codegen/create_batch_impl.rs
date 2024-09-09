use quote::quote;
use quote::ToTokens;

pub(crate) struct CreateBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) chunk_size_limit: usize,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) field_count: usize,
}

impl ToTokens for CreateBatchImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            chunk_size_limit,
            row,
            changeset,
            field_count,
        } = self;
        let span_name = format!("model:create_batch<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::models::CreateBatch<#changeset> for #model {
                #[tracing::instrument(name = #span_name, skip_all, err)]
                async fn create_batch<
                    I: std::iter::IntoIterator<Item = #changeset> + Send + 'async_trait,
                    C: Default + std::iter::Extend<Self> + Send + std::fmt::Debug,
                >(
                    conn: &mut editoast_models::DbConnection,
                    values: I,
                ) -> crate::error::Result<C> {
                    use crate::models::Model;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    let values = values.into_iter().collect::<Vec<_>>();
                    Ok(crate::chunked_for_libpq! {
                        #field_count,
                        #chunk_size_limit,
                        values,
                        C::default(),
                        chunk => {
                            diesel::insert_into(dsl::#table_name)
                                .values(chunk)
                                .load_stream::<#row>(conn.write().await.deref_mut())
                                .await
                                .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                .await?
                        }
                    })
                }
            }
        });
    }
}
