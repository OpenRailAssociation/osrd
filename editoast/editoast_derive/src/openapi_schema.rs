use proc_macro2::TokenStream;
use syn::DeriveInput;
use syn::Ident;

pub(super) fn openapi_schema(input: &DeriveInput) -> darling::Result<TokenStream> {
    let name = &input.ident;
    let static_name = Ident::new(
        &format!("{}_SLICE_ITEM", name.to_string().to_uppercase()),
        name.span(),
    );
    Ok(quote::quote! {
        #[doc(hidden)]
        #[linkme::distributed_slice(common::OPENAPI_SCHEMAS)]
        static #static_name: common::OpenApiSchemaSliceItem = || (<#name as utoipa::ToSchema>::name(), <#name as utoipa::PartialSchema>::schema());

        #input
    })
}
