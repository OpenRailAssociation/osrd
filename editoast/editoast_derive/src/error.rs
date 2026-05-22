use darling::Error;
use darling::FromDeriveInput;
use darling::FromVariant;
use darling::Result;
use proc_macro2::TokenStream;
use quote::ToTokens;
use quote::quote;
use syn::DataEnum;
use syn::DeriveInput;
use syn::Fields;
use syn::Ident;
use syn::Lit;
use syn::ext::IdentExt;

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
    forward: Option<bool>,
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

    let get_type_lt = if variants.iter().any(|v| v.params.forward.unwrap_or(false)) {
        quote! {}
    } else {
        quote! {'static}
    };

    Ok(quote! {
        #error_definitions

        impl crate::error::EditoastError for #name {
            fn get_status(&self) -> axum::http::StatusCode {
                #get_statuses
            }

            fn get_type(&self) -> &#get_type_lt str {
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
    if variant.params.forward.unwrap_or(false) {
        // Forwarded variants forward their error types, we don't want to register them as error definitions
        return Ok(quote! {});
    }

    //Error name
    let name = variant.ident.unraw().to_string();

    // Compute its id
    let id = format!("editoast:{base_id}:{name}");

    // Retrieve error status (or get the default one)
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

                if params.forward.unwrap_or(false) {
                    if params.status.is_some() {
                        return Err(darling::Error::custom(
                            "explicit status is incompatible with forward attribute",
                        ));
                    }

                    if !matches!(&fields, Fields::Unnamed(fields_unnamed) if fields_unnamed.unnamed.len() == 1) {
                        return Err(darling::Error::custom(
                            "forward attribute can only be used on tuple variants with a single field",
                        ));
                    }
                }

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

fn forward_binding() -> syn::Ident {
    syn::Ident::new(
        "__editoast_error_unamed_field",
        proc_macro2::Span::mixed_site(),
    )
}

fn match_variants<'a>(variants: &'a [ParsedVariant]) -> impl Iterator<Item = TokenStream> + 'a {
    let forward_binding = forward_binding();
    variants.iter().map(move |variant| {
        let ident = &variant.ident;
        match &variant.fields {
            Fields::Named(fields_named) => {
                let field_ident = fields_named.named.iter().map(|f| {
                    let ident = f.ident.clone().unwrap();
                    quote! {#ident}
                });
                quote! {#ident { #(#field_ident),* }}
            }
            Fields::Unnamed(fields_unnamed) if fields_unnamed.unnamed.len() == 1 => {
                quote! { #ident(#forward_binding) }
            }
            Fields::Unnamed(..) => quote! { #ident(..) },
            Fields::Unit => quote! {#ident},
        }
    })
}

fn expand_get_statuses(variants: &[ParsedVariant], default_status: u16) -> Result<TokenStream> {
    let forward_binding = forward_binding();
    let match_variants = match_variants(variants);

    let statuses = variants.iter().map(|variant| {
        if variant.params.forward.unwrap_or(false) {
            return quote!{ #forward_binding.get_status() }
        }

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
    let forward_binding = forward_binding();
    let match_variants = match_variants(variants);

    let ids = variants.iter().map(|variant| {
        if variant.params.forward.unwrap_or(false) {
            quote! { #forward_binding.get_type() }
        } else {
            let id = format!("editoast:{}:{}", base_id, variant.ident);
            quote! { #id }
        }
    });

    quote! {
        match self {
            #(#[allow(unused)] Self::#match_variants => #ids),*
        }
    }
}

fn expand_contexts(variants: &[ParsedVariant]) -> TokenStream {
    let context = variants.iter().map(|variant| {
        let ident = &variant.ident;
        let no_context = variant.params.no_context.unwrap_or(false);
        let forward = variant.params.forward.unwrap_or(false);
        match (&variant.fields, no_context, forward) {
            (Fields::Named(fields_named), false, _) => {
                let field_ident = fields_named.named.iter().map(|f| {
                    let ident = f.ident.clone().unwrap();
                    quote! {#ident}
                });
                let field_ident2 = field_ident.clone();
                let field_ident3 = field_ident.clone();
                quote! {Self::#ident { #(#field_ident),*} => [#((stringify!(#field_ident2).to_string(), serde_json::to_value(#field_ident3).unwrap())),*].into()}
            }
            (Fields::Unnamed(_), false, true) => {
                let forward_ident = forward_binding();
                quote! {Self::#ident(#forward_ident) => #forward_ident.context()}
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
        _ => Some(ty.to_token_stream().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_construction() {
        crate::assert_macro_expansion!(
            expand_editoast_error,
            syn::parse_quote! {
                #[derive(EditoastError)]
                #[editoast_error(base_id = "infra", default_status = 500)]
                pub enum InfraApiError {
                    #[editoast_error(status = 404, no_context)]
                    NotFound { infra_id: i64 },
                    #[editoast_error(status = 400)]
                    BadRequest { message: String },
                    #[editoast_error(forward)]
                    WithInner(#[from] InnerError),
                    InternalError,
                }
            }
        );
    }
}
