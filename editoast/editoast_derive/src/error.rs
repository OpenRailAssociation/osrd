use std::collections::HashMap;

use darling::{Error, Result};
use darling::{FromDeriveInput, FromVariant};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{DataEnum, DeriveInput, Ident, Path};

const DEFAULT_STATUS_CODE: u16 = 400;

#[derive(FromDeriveInput)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorOptions {
    base_id: String,
    #[darling(rename = "context")]
    context_function: Option<Path>,
    default_status: Option<u16>,
}

#[derive(FromVariant)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorVariantParams {
    status: Option<u16>,
}

pub fn expand_editoast_error(input: &mut DeriveInput) -> Result<TokenStream> {
    let options = ErrorOptions::from_derive_input(&input)?;

    let name = &input.ident;
    let base_id = options.base_id;

    let enum_data = match &input.data {
        syn::Data::Enum(data) => data,
        _ => return Err(Error::custom("EditoastError: Only enums are supported.")),
    };
    let variants = parse_variants(&enum_data)?;

    let get_statuses = expand_get_statuses(
        &variants,
        options.default_status.unwrap_or(DEFAULT_STATUS_CODE),
    )?;
    let contexts = expand_contexts(&options.context_function);
    let get_types = expand_get_types(&variants, base_id.clone());

    Ok(quote! {
        impl crate::error::EditoastError for #name {
            fn get_status(&self) -> actix_web::http::StatusCode {
                #get_statuses
            }

            fn get_type(&self) -> &'static str {
                #get_types
            }

            fn context(&self) -> serde_json::Map<String, serde_json::Value> {
                #contexts
            }
        }
    })
}

fn parse_variants(enum_data: &DataEnum) -> Result<HashMap<Ident, ErrorVariantParams>> {
    let mut errors = Error::accumulator();
    let variants: HashMap<_, _> = enum_data
        .variants
        .iter()
        .filter_map(|v| {
            errors.handle_in(|| {
                let ident = v.ident.clone();
                let params = ErrorVariantParams::from_variant(v)?;
                Ok((ident, params))
            })
        })
        .collect();
    errors.finish()?;
    Ok(variants)
}

fn expand_get_statuses(
    variants: &HashMap<Ident, ErrorVariantParams>,
    default_status: u16,
) -> Result<TokenStream> {
    let match_variants = variants.keys().map(|variant_name| {
        quote! {#variant_name {..}}
    });

    let statuses = variants.values().map(|params| {
        let status = params.status.unwrap_or(default_status);
        quote! { actix_web::http::StatusCode::from_u16(#status).unwrap() }
    });

    Ok(quote! {
        match self {
            #(Self::#match_variants => #statuses),*
        }
    })
}

fn expand_get_types(variants: &HashMap<Ident, ErrorVariantParams>, base_id: String) -> TokenStream {
    let match_variants = variants.keys().map(|variant_name| {
        quote! {#variant_name {..}}
    });

    let ids = variants
        .keys()
        .map(|variant_name| format!("editoast:{}:{}", base_id, variant_name));

    quote! {
        match self {
            #(Self::#match_variants => #ids),*
        }
    }
}

fn expand_contexts(ctx_function: &Option<Path>) -> TokenStream {
    if let Some(ctx_function) = ctx_function {
        quote! {
            #ctx_function(self)
        }
    } else {
        quote! {
            Default::default()
        }
    }
}
