use super::np;
use proc_macro2::Ident;
use proc_macro2::Span;
use quote::ToTokens;
use quote::quote;

fn to_snake_case_upper(s: &str) -> String {
    let mut result = String::new();
    for c in s.chars() {
        if c.is_uppercase() && !result.is_empty() {
            result.push('_');
        }
        result.push(c.to_uppercase().next().unwrap());
    }
    result
}

pub(crate) struct ModelFieldsImplBlock {
    pub(super) model: syn::Ident,
    pub(super) fields: Vec<ModelFieldDecl>,
    pub(super) field_wrapper: syn::Ident,
}

pub(crate) struct ModelFieldDecl {
    pub(super) name: syn::Ident,
    pub(super) ty: syn::Type,
    pub(super) column: syn::Path,
}

impl ToTokens for ModelFieldsImplBlock {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            fields,
            field_wrapper,
        } = self;
        let np!(name, ty, column): np!(vec3) = fields
            .iter()
            .map(|field| {
                let ModelFieldDecl { name, ty, column } = field;
                let const_name =
                    Ident::new(&to_snake_case_upper(&name.to_string()), Span::call_site());
                np!(const_name, ty, column)
            })
            .unzip();

        tokens.extend(quote! {
            impl #model {
                #(pub const #name: #field_wrapper<#model, #ty, #column> = #field_wrapper(core::marker::PhantomData);)*
            }
        });
    }
}
