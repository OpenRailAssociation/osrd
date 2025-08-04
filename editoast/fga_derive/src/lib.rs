//! Derive macros for the `fga` crate

use darling::FromDeriveInput as _;
use proc_macro::TokenStream;
use syn::DeriveInput;

#[derive(Debug, darling::FromDeriveInput)]
#[darling(
    attributes(fga),
    forward_attrs(allow, doc, cfg),
    supports(struct_newtype, struct_named, struct_tuple)
)]
struct TypeArgs {
    #[darling(default)]
    name: Option<String>,

    ident: syn::Ident,
    data: darling::ast::Data<darling::util::Ignored, TypeFieldArgs>,
}

#[derive(Debug, PartialEq, Eq, darling::FromField)]
#[darling(attributes(fga), forward_attrs(allow, doc, cfg))]
struct TypeFieldArgs {
    #[darling(default)]
    id: bool,
    ident: Option<syn::Ident>,
}

fn expand_type(input: &DeriveInput) -> darling::Result<TokenStream> {
    let TypeArgs { name, ident, data } = TypeArgs::from_derive_input(input)?;

    let name = name.unwrap_or_else(|| ident.to_string().to_lowercase());

    let Some(fields) = data.take_struct() else {
        return Err(darling::Error::unsupported_shape("enum"));
    };

    let id_field = fields
        .fields
        .iter()
        .find(|field| field.id)
        .or_else(|| fields.fields.first())
        .ok_or_else(|| darling::Error::unsupported_shape("unit struct"))?;

    let id_field_ident = match id_field.ident {
        Some(ref ident) => quote::quote! { #ident },
        None => {
            let index = fields
                .fields
                .iter()
                .position(|field| field == id_field)
                .unwrap();
            let index = syn::Index::from(index);
            quote::quote! { #index }
        }
    };

    Ok(quote::quote! {
        impl fga::model::Type for #ident {
            const NAMESPACE: &'static str = #name;
            fn id(&self) -> impl ToString {
                &self.#id_field_ident
            }
        }
    }
    .into())
}

/// Derive macro for the trait `fga::model::Type`
///
/// The `#[fga(id)]` must implement `AsRef<str>`.
///
/// Valid forms:
///
/// ```ignore
/// #[derive(Type)]
/// #[fga(name = "mytype")]
/// struct MyType(u64, #[fga(id)] String);
///
/// #[derive(Type)] // name defaults to the struct name lowercased
/// struct Document { doc_id: String } // id defaults to the first field if not specified
///
/// #[derive(Type)]
/// struct Group(String);
/// ```
#[proc_macro_derive(Type, attributes(fga))]
pub fn derive_type(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as DeriveInput);
    match expand_type(&input) {
        Ok(expanded) => expanded,
        Err(e) => e.write_errors().into(),
    }
}

/// Derive macro for the trait `fga::model::User`
#[proc_macro_derive(User)]
pub fn derive_user(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as DeriveInput);
    let ident = input.ident;
    quote::quote! {
        impl fga::model::User for #ident {}
    }
    .into()
}

/// Derive macro for the trait `fga::model::Object`
#[proc_macro_derive(Object)]
pub fn derive_object(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as DeriveInput);
    let ident = input.ident;
    quote::quote! {
        impl fga::model::Object for #ident {}
    }
    .into()
}
