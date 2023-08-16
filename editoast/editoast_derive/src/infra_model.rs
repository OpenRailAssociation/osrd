use darling::FromDeriveInput;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[derive(FromDeriveInput)]
#[darling(attributes(infra_model))]
struct ModelOptions {
    table: syn::Path,
}

pub fn infra_model(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let options = ModelOptions::from_derive_input(&input).expect("Model: bad options");
    let name = input.ident;
    let table = options.table;

    let expanded = quote! {
        impl #name {
            pub async fn persist_batch(
                values: &[Self],
                infrastructure_id: i64,
                conn: &mut diesel_async::AsyncPgConnection,
            ) -> crate::error::Result<()> {
                use #table::dsl::*;
                use diesel_async::RunQueryDsl;
                use diesel::ExpressionMethods;

                // Work around a diesel limitation
                // See https://github.com/diesel-rs/diesel/issues/2414
                // Divided by 3 here because we are inserting three values
                // When using AsyncPgConnection, we must divide again
                // Maybe it is related to connection pipelining
                const DIESEL_MAX_VALUES : usize = (2_usize.pow(16) - 1)/3/2;
                let futures = values.chunks(DIESEL_MAX_VALUES).map(|chunk| {
                    let values = chunk.iter()
                    .map(|value| {
                        (
                            obj_id.eq(value.get_id().clone()),
                            data.eq(serde_json::to_value(value).unwrap()),
                            infra_id.eq(infrastructure_id),
                        )
                    })
                    .collect::<Vec<_>>();

                    diesel::insert_into(#table::table)
                        .values(values)
                        .execute(conn)
                });

                futures::future::try_join_all(futures).await.map(|_| Ok(()))?
            }
        }
    };

    proc_macro::TokenStream::from(expanded)
}
