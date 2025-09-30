use std::hash::Hash as _;
use std::hash::Hasher as _;

use proc_macro2::TokenStream;
use syn::Ident;
use syn::ItemFn;

pub(super) fn route(input: &ItemFn) -> darling::Result<TokenStream> {
    let name = &input.sig.ident;
    // some handlers have the same name (eg: get, create, list) which would result in duplicate
    // static names
    let hex_hash = {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        quote::quote! { #input }.to_string().hash(&mut hasher);
        let hash = hasher.finish();
        format!("{hash:x}")
    };
    let static_name = Ident::new(
        &format!(
            "_{}_OPENAPI_ROUTE_{}",
            name.to_string().to_uppercase(),
            hex_hash.to_uppercase()
        ),
        name.span(),
    );
    let path_name = Ident::new(&format!("__path_{name}"), name.span());
    Ok(quote::quote! {
        #[doc(hidden)]
        #[linkme::distributed_slice(crate::views::router::OPENAPI_ROUTES)]
        static #static_name: crate::views::router::OpenApiRouteSliceItem = |type_name: &str| {
            (type_name == std::any::type_name_of_val(&#name)).then_some(|| {
                use utoipa::Path;
                use utoipa::__dev::Tags; // private API, but can't find another way :/
                use utoipa::__dev::SchemaReferences; // same...

                let mut schemas = Vec::new();
                <#path_name as SchemaReferences>::schemas(&mut schemas);

                crate::views::router::RouteDocumentation {
                    http_methods: <#path_name as Path>::methods(),
                    operation: <#path_name as Path>::operation(),
                    tags: <#path_name as Tags>::tags(),
                    schemas,
                }
            })
        };

        #input
    })
}
