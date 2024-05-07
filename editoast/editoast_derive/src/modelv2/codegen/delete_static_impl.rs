use quote::quote;
use quote::ToTokens;

use crate::modelv2::identifier::Identifier;

pub(crate) struct DeleteStaticImpl {
    pub(super) model: syn::Ident,
    pub(super) table_name: syn::Ident,
    pub(super) table_mod: syn::Path,
    pub(super) identifier: Identifier,
}

impl ToTokens for DeleteStaticImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            table_name,
            table_mod,
            identifier,
        } = self;
        let ty = identifier.get_type();
        let id_ident = identifier.get_lvalue();
        let eqs = identifier.get_diesel_eqs();
        let span_name = format!("model:delete_static<{}>", model);

        tokens.extend(quote! {
            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::DeleteStatic<#ty> for #model {
                #[tracing::instrument(name = #span_name, skip_all)]
                async fn delete_static(
                    conn: &mut crate::modelsv2::DbConnection,
                    #id_ident: #ty,
                ) -> crate::error::Result<bool> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    diesel::delete(dsl::#table_name.#(filter(#eqs)).*)
                        .execute(conn)
                        .await
                        .map(|n| n == 1)
                        .map_err(Into::into)
                }
            }
        });
    }
}
