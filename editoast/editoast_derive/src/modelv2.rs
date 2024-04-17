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
use identifier::Identifier;

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
    let from_impls = config.make_from_impls();

    let cs_builder = config.make_builder(true);
    let patch_builder = config.make_builder(false);

    let model_impls = config.make_model_traits_impl();

    Ok(quote! {
        #model_impl
        #row_decl
        #changeset_decl

        #(#identifiable_impls)*
        #preferred_id_impl

        #model_from_row_impl

        #from_impls
        #cs_builder
        #patch_builder
        #model_impls
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
