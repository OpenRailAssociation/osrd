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
    let config = ModelConfig::from_macro_args(options, model_name.clone())?;

    let identifiers_impls = config.make_identifiers_impls();
    let model_decl = config.make_model_decl(model_vis);
    let from_impls = config.make_from_impls();

    let cs_builder = config.make_builder(true);
    let patch_builder = config.make_builder(false);

    let model_impls = config.make_model_traits_impl();

    Ok(quote! {
        #identifiers_impls
        #model_decl
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
