use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct UpdateImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) row: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) identifier: Identifier,
}

impl ToTokens for UpdateImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            row,
            changeset,
            identifier,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let id_ref_ident = identifier.get_ref_lvalue();
        let eqs = identifier.get_diesel_eqs();
        let span_name = format!("model:update<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Update<#ty, #model> for #changeset {
                #[tracing::instrument(name = #span_name, skip_all, err, fields(query_id))]
                async fn update(
                    self,
                    conn: &mut crate::modelsv2::DbConnection,
                    #id_ident: #ty,
                ) -> crate::error::Result<Option<#model>> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    tracing::Span::current().record("query_id", tracing::field::debug(#id_ref_ident));
                    diesel::update(dsl::#table_name.#(filter(#eqs)).*)
                        .set(&self)
                        .get_result::<#row>(conn)
                        .await
                        .map(Into::into)
                        .optional()
                        .map_err(Into::into)
                }
            }
        });
    }
}
