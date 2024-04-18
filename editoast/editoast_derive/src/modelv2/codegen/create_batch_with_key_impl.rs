use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct CreateBatchWithKeyImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) field_count: usize,
    pub(super) identifier: Identifier,
}

impl ToTokens for CreateBatchWithKeyImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            row,
            changeset,
            field_count,
            identifier,
        } = self;
        let ty = identifier.get_type();

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::CreateBatchWithKey<#changeset, #ty> for #model {
                async fn create_batch_with_key<
                    I: std::iter::IntoIterator<Item = #changeset> + Send + 'async_trait,
                    C: Default + std::iter::Extend<(#ty, Self)> + Send,
                >(
                    conn: &mut diesel_async::AsyncPgConnection,
                    values: I,
                ) -> crate::error::Result<C> {
                    use crate::models::Identifiable;
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    Ok(crate::chunked_for_libpq! {
                        #field_count,
                        values,
                        C::default(),
                        chunk => {
                            diesel::insert_into(dsl::#table_name)
                                .values(chunk)
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
