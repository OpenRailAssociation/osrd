use darling::{Error, Result};
use darling::{FromDeriveInput, FromVariant};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{DataEnum, DeriveInput, Fields, Ident};

const DEFAULT_STATUS_CODE: u16 = 400;

#[derive(FromDeriveInput)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorOptions {
    base_id: String,
    default_status: Option<u16>,
}

#[derive(FromVariant)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorVariantParams {
    status: Option<u16>,
    no_context: Option<bool>,
}

struct ParsedVariant {
    ident: Ident,
    params: ErrorVariantParams,
    fields: Fields,
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
    let contexts = expand_contexts(&variants);
    let get_types = expand_get_types(&variants, base_id.clone());

    Ok(quote! {
        impl crate::error::EditoastError for #name {
            fn get_status(&self) -> actix_web::http::StatusCode {
                #get_statuses
            }

            fn get_type(&self) -> &'static str {
                #get_types
            }

            fn context(&self) -> std::collections::HashMap<String, serde_json::Value> {
                #contexts
            }
        }
    })
}

fn parse_variants(enum_data: &DataEnum) -> Result<Vec<ParsedVariant>> {
    let mut errors = Error::accumulator();
    let variants: Vec<_> = enum_data
        .variants
        .iter()
        .filter_map(|v| {
            errors.handle_in(|| {
                let ident = v.ident.clone();
                let params = ErrorVariantParams::from_variant(v)?;
                let fields = v.fields.clone();
                Ok(ParsedVariant {
                    ident,
                    params,
                    fields,
                })
            })
        })
        .collect();
    errors.finish()?;
    Ok(variants)
}

fn expand_get_statuses(variants: &Vec<ParsedVariant>, default_status: u16) -> Result<TokenStream> {
    let match_variants = variants.iter().map(|variant| {
        let ident = &variant.ident;
        quote! {#ident {..}}
    });

    let statuses = variants.iter().map(|variant| {
        let status = variant.params.status.unwrap_or(default_status);
        quote! { actix_web::http::StatusCode::from_u16(#status).unwrap() }
    });

    Ok(quote! {
        match self {
            #(Self::#match_variants => #statuses),*
        }
    })
}

fn expand_get_types(variants: &Vec<ParsedVariant>, base_id: String) -> TokenStream {
    let match_variants = variants.iter().map(|variant| {
        let ident = &variant.ident;
        quote! {#ident {..}}
    });

    let ids = variants
        .iter()
        .map(|variant| format!("editoast:{}:{}", base_id, variant.ident));

    quote! {
        match self {
            #(Self::#match_variants => #ids),*
        }
    }
}

fn expand_contexts(variants: &Vec<ParsedVariant>) -> TokenStream {
    let context = variants.iter().map(|variant| {
        let ident = &variant.ident;
        let no_context = variant.params.no_context.unwrap_or(false);
        match (&variant.fields, no_context) {
            (Fields::Named(fields_named), false) => {
                let field_ident = fields_named.named.iter().map(|f| {
                    let ident = f.ident.clone().unwrap();
                    quote! {#ident}
                });
                let field_ident2 = field_ident.clone();
                let field_ident3 = field_ident.clone();
                quote! {Self::#ident { #(#field_ident),*} => [#((stringify!(#field_ident2).to_string(), serde_json::to_value(#field_ident3).unwrap())),*].into()}
            }
            _ => quote! {Self::#ident {..} => Default::default()},
        }
    });
    quote! {
        match self {
            #(#context),*
        }
    }
}
