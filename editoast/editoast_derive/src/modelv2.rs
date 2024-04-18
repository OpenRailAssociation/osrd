mod args;
mod codegen;
mod config;
mod identifier;
mod parsing;
mod utils;

use darling::FromDeriveInput as _;
use darling::Result;
use proc_macro2::TokenStream;
use quote::quote;
use syn::DeriveInput;

use args::ModelArgs;
use config::*;
use identifier::RawIdentifier;

pub fn model(input: &DeriveInput) -> Result<TokenStream> {
    let model_name = &input.ident;
    let model_vis = &input.vis;
    let options = ModelArgs::from_derive_input(input)?;
    let config = ModelConfig::from_macro_args(options, model_name.clone(), model_vis.clone())?;

    let model_impl = config.model_impl();
    let row_decl = config.row_decl();
    let changeset_decl = config.changeset_decl();

    let identifiable_impls = config.identifiable_impls();
    let preferred_id_impl = config.preferred_id_impl();

    let model_from_row_impl = config.model_from_row_impl();
    let changeset_from_model_impl = config.changeset_from_model_impl();

    let changeset_builder = config.changeset_builder_impl_block();
    let patch_builder = config.patch_builder_impl_block();

    let exist_impls = config.exists_impls();
    let retrieve_impls = config.retrieve_impls();
    let update_impls = config.update_impls();
    let delete_static_impls = config.delete_static_impls();
    let create_impl = config.create_impl();
    let delete_impl = config.delete_impl();
    let create_batch_impl = config.create_batch_impl();
    let create_batch_with_key_impls = config.create_batch_with_key_impls();
    let retrieve_batch_impls = config.retrieve_batch_impls();
    let update_batch_impls = config.update_batch_impls();
    let delete_batch_impls = config.delete_batch_impls();

    Ok(quote! {
        #model_impl
        #row_decl
        #changeset_decl

        #(#identifiable_impls)*
        #preferred_id_impl

        #model_from_row_impl
        #changeset_from_model_impl

        #changeset_builder
        #patch_builder

        #(#exist_impls)*
        #(#retrieve_impls)*
        #(#update_impls)*
        #(#delete_static_impls)*
        #create_impl
        #delete_impl
        #create_batch_impl
        #(#create_batch_with_key_impls)*
        #(#retrieve_batch_impls)*
        #(#update_batch_impls)*
        #(#delete_batch_impls)*
    })
}

#[cfg(test)]
#[test]
fn test_construction() {
    let input = syn::parse_quote! {
        #[derive(Clone, Model)]
        #[model(table = crate::tables::osrd_infra_document)]
        #[model(row(type_name = "DocumentRow", derive(Debug)))]
        #[model(changeset(type_name = "DocumentChangeset", public, derive(Debug)))] // fields are public
        struct Document {
            #[model(column = "id", preferred, primary)]
            id_: i64,
            #[model(identifier, json)]
            content_type: String,
            data: Vec<u8>,
        }
    };
    let _ = model(&input).expect("should generate");
}
