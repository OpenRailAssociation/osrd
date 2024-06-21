use quote::quote;
use quote::ToTokens;

pub(crate) struct CreateImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
}

impl ToTokens for CreateImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            row,
            changeset,
        } = self;
        let span_name = format!("model:create<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Create<#model> for #changeset {
                #[tracing::instrument(name = #span_name, skip_all, err)]
                async fn create(
                    self,
                    conn: &mut editoast_models::DbConnection,
                ) -> crate::error::Result<#model> {
                    use diesel_async::RunQueryDsl;
                    diesel::insert_into(#table_mod::table)
                        .values(&self)
                        .get_result::<#row>(conn)
                        .await
                        .map(Into::into)
                        .map_err(Into::into)
                }
            }
        });
    }
}
