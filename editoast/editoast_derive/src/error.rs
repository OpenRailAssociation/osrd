use darling::{Error, Result};
use darling::{FromDeriveInput, FromVariant};
use proc_macro2::TokenStream;
use quote::quote;
use syn::ext::IdentExt;
use syn::{DataEnum, DeriveInput, Fields, Ident, Lit};

const DEFAULT_STATUS_CODE: u16 = 400;

#[derive(FromDeriveInput)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorOptions {
    base_id: String,
    default_status: Option<u16>,
}

#[derive(Debug, FromVariant)]
#[darling(attributes(editoast_error), forward_attrs(allow, doc, cfg))]
struct ErrorVariantParams {
    status: Option<syn::Expr>,
    no_context: Option<bool>,
}

#[derive(Debug)]
struct ParsedVariant {
    ident: Ident,
    params: ErrorVariantParams,
    fields: Fields,
}

pub fn expand_editoast_error(input: &DeriveInput) -> Result<TokenStream> {
    let options = ErrorOptions::from_derive_input(input)?;
    let name = &input.ident;
    let base_id = options.base_id;

    let enum_data = match &input.data {
        syn::Data::Enum(data) => data,
        _ => return Err(Error::custom("EditoastError: Only enums are supported.")),
    };
    let variants = parse_variants(enum_data)?;
    let default_status = options.default_status.unwrap_or(DEFAULT_STATUS_CODE);
    let get_statuses = expand_get_statuses(&variants, default_status)?;

    let contexts = expand_contexts(&variants);
    let get_types = expand_get_types(&variants, &base_id);

    let error_defs_namespace = name.to_string();
    let error_definition = variants
        .iter()
        .map(|v| parse_error_definition(&base_id, default_status, &error_defs_namespace, v))
        .collect::<Result<Vec<TokenStream>>>()?;

    let error_definitions: TokenStream = error_definition.into_iter().collect();
    Ok(quote! {
        #error_definitions

        impl crate::error::EditoastError for #name {
            fn get_status(&self) -> axum::http::StatusCode {
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

fn parse_error_definition(
    base_id: &String,
    default_status: u16,
    namespace: &String,
    variant: &ParsedVariant,
) -> Result<TokenStream> {
    //Error name
    let name = variant.ident.unraw().to_string();

    // Compute its id
    let id = format!("editoast:{}:{}", base_id, name);

    // Retieve error status (or get the default one)
    let status = match variant.params.status.as_ref() {
        Some(syn::Expr::Lit(exprlit)) => match &exprlit.lit {
            Lit::Int(lit) => lit.base10_parse::<u16>().unwrap(),
            _ => default_status,
        },
        _ => default_status,
    };

    // Retrieve the list of parameters that are given in the error
    let mut context = std::collections::HashMap::new();
    let untyped_prop: Vec<String> = variant
        .fields
        .iter()
        .filter_map(|field| match field.ident.as_ref() {
            Some(name) => {
                let prop_name = name.to_string();
                match extract_type(&field.ty) {
                    Some(prop_type) => {
                        context.insert(prop_name, prop_type);
                        None
                    }
                    _ => Some(prop_name),
                }
            }
            _ => None,
        })
        .collect();

    if !untyped_prop.is_empty() {
        return Err(Error::custom(format!(
            "EditoastError: Can't find the type of properties {} on error {}",
            untyped_prop.join(", "),
            name
        )));
    }

    let context_serialized = serde_json::to_string(&context).unwrap();
    Ok(quote! {
        inventory::submit! {
            crate::error::ErrorDefinition::new(#id, #name, #namespace, #status, #context_serialized )
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

fn expand_get_statuses(variants: &[ParsedVariant], default_status: u16) -> Result<TokenStream> {
    let match_variants = variants.iter().map(|variant| {
        let ident = &variant.ident;
        match &variant.fields {
            Fields::Named(fields_named) => {
                let field_ident = fields_named.named.iter().map(|f| {
                    let ident = f.ident.clone().unwrap();
                    quote! {#ident}
                });
                quote! {#ident { #(#field_ident),* }}
            }
            Fields::Unnamed(_) => quote! {#ident(..)},
            Fields::Unit => quote! {#ident},
        }
    });

    let statuses = variants.iter().map(|variant| {
        let Some(status) = variant.params.status.as_ref() else {
            return quote! { axum::http::StatusCode::from_u16(#default_status).unwrap() };
        };
        quote! { axum::http::StatusCode::try_from(#status).expect("EditoastError: invalid status expression") }
    });

    Ok(quote! {
        match self {
            #(#[allow(unused)] Self::#match_variants => #statuses),*
        }
    })
}

fn expand_get_types(variants: &[ParsedVariant], base_id: &String) -> TokenStream {
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

fn expand_contexts(variants: &[ParsedVariant]) -> TokenStream {
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

// https://stackoverflow.com/questions/55271857/how-can-i-get-the-t-from-an-optiont-when-using-syn
fn extract_type(ty: &syn::Type) -> Option<String> {
    match *ty {
        syn::Type::Path(ref typepath) => {
            if typepath.qself.is_none() {
                let path = &typepath.path;
                let segment = path.segments.first();
                segment.map(|x| x.ident.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}
