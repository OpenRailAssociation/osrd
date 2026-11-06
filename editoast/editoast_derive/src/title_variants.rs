use proc_macro2::TokenStream;
use proc_macro2::TokenTree;
use quote::quote;
use syn::Attribute;
use syn::ItemEnum;
use syn::LitStr;
use syn::Token;
use syn::parse_quote;

fn schema_title(attrs: &[Attribute]) -> syn::Result<Option<String>> {
    let mut title = None;
    for attr in attrs.iter().filter(|attr| attr.path().is_ident("schema")) {
        attr.parse_nested_meta(|meta| {
            if meta.path.is_ident("title") {
                title = Some(meta.value()?.parse::<LitStr>()?.value());
            } else {
                // Leave other utoipa options untouched, including expressions,
                // nested groups and keyword options such as `as = ...`.
                while !meta.input.is_empty() && !meta.input.peek(Token![,]) {
                    meta.input.parse::<TokenTree>()?;
                }
            }
            Ok(())
        })?;
    }
    Ok(title)
}

pub fn expand_title_variants(mut input: ItemEnum) -> syn::Result<TokenStream> {
    let prefix = schema_title(&input.attrs)?.unwrap_or_else(|| input.ident.to_string());
    for variant in &mut input.variants {
        if schema_title(&variant.attrs)?.is_none() {
            let title = format!("{prefix}{}", variant.ident);
            variant.attrs.push(parse_quote!(#[schema(title = #title)]));
        }
    }
    Ok(quote!(#input))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titles_all_variant_shapes_and_preserves_attributes() {
        let expanded = expand_title_variants(parse_quote! {
            /// Documentation
            #[derive(utoipa::ToSchema)]
            #[schema(as = ApiExample, example = json!(["a", 2]))]
            #[serde(tag = "type", rename_all = "snake_case")]
            pub enum Example<T> {
                Unit,
                Tuple(T),
                #[schema(description = "Named variant")]
                Named { value: T },
            }
        })
        .unwrap();
        let expected = quote! {
            /// Documentation
            #[derive(utoipa::ToSchema)]
            #[schema(as = ApiExample, example = json!(["a", 2]))]
            #[serde(tag = "type", rename_all = "snake_case")]
            pub enum Example<T> {
                #[schema(title = "ExampleUnit")]
                Unit,
                #[schema(title = "ExampleTuple")]
                Tuple(T),
                #[schema(description = "Named variant")]
                #[schema(title = "ExampleNamed")]
                Named { value: T },
            }
        };
        assert_eq!(expanded.to_string(), expected.to_string());
    }

    #[test]
    fn uses_enum_title_and_preserves_explicit_variant_titles() {
        let expanded = expand_title_variants(parse_quote! {
            #[schema(title = "Prefix")]
            enum Example {
                Generated { value: bool },
                #[schema(description = "Custom", title = "Override")]
                Explicit(String),
            }
        })
        .unwrap();
        let expected = quote! {
            #[schema(title = "Prefix")]
            enum Example {
                #[schema(title = "PrefixGenerated")]
                Generated { value: bool },
                #[schema(description = "Custom", title = "Override")]
                Explicit(String),
            }
        };
        assert_eq!(expanded.to_string(), expected.to_string());
    }

    #[test]
    fn rejects_non_string_titles() {
        let result = expand_title_variants(parse_quote! {
            #[schema(title = 42)]
            enum Example { Unit }
        });
        assert!(result.is_err());
    }
}
