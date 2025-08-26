use quote::ToTokens;
use quote::quote;

use super::LibpqChunkedIteration;

pub(crate) struct CreateBatchImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) chunk_size_limit: usize,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) field_count: usize,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
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
            columns,
            error,
        } = self;
        let span_name = format!("model:create_batch<{model}>");

        let create_loop = LibpqChunkedIteration {
            parameters_per_row: *field_count,
            chunk_size_limit: *chunk_size_limit,
            values_ident: syn::parse_quote! { values },
            collector: super::LibpqChunkedIterationCollector::Extend {
                collection_init: syn::parse_quote! { C::default() },
            },
            chunk_iteration_ident: syn::parse_quote! { chunk },
            chunk_iteration_body: quote! {
                diesel::insert_into(dsl::#table_name)
                    .values(chunk)
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

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::CreateBatch for #model {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err)]
                async fn create_batch<
                    I: std::iter::IntoIterator<Item = #changeset> + Send,
                    C: Default + std::iter::Extend<Self> + Send + std::fmt::Debug,
                >(
                    conn: &mut database::DbConnection,
                    values: I,
                ) -> std::result::Result<C, Self::Error> {
                    use crate::prelude::Model;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    let values = values.into_iter().collect::<Vec<_>>();
                    Ok({ #create_loop })
                }
            }
        });
    }
}
