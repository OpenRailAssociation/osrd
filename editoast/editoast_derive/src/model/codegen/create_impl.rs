use quote::ToTokens;
use quote::quote;

pub(crate) struct CreateImpl {
    pub(super) model: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) empty_changeset: bool,
    pub(super) columns: Vec<syn::Ident>,
    pub(super) error: syn::Path,
}

impl ToTokens for CreateImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_mod,
            row,
            changeset,
            empty_changeset,
            columns,
            error,
        } = self;
        let span_name = format!("model:create<{model}>");

        // If the changeset has no fields, it cannot derive Insertable.
        let values = if *empty_changeset {
            quote! { default_values() }
        } else {
            quote! { values(&self) }
        };

        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::prelude::Create<#model> for #changeset {
                type Error = #error;

                #[tracing::instrument(name = #span_name, skip_all, err)]
                async fn create(
                    self,
                    conn: &mut database::DbConnection,
                ) -> std::result::Result<#model, Self::Error> {
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    use std::ops::DerefMut;
                    diesel::insert_into(#table_mod::table)
                        .#values
                        .returning((#(dsl::#columns,)*))
                        .get_result::<#row>(conn.write().await.deref_mut())
                        .await
                        .map(Into::into)
                        .map_err(|e| Self::Error::from(editoast_models::Error::from(e)))
                }
            }
        });
    }
}
