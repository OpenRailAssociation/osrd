use proc_macro2::Span;
use quote::ToTokens;
use quote::quote;
use syn::parse_quote;

use crate::model::ModelField;

pub(crate) struct ChangesetBuilderImplBlock {
    pub(super) changeset: syn::Ident,
    pub(super) fields: Vec<ModelField>,
}

impl ChangesetBuilderImplBlock {
    fn builder_field_fn_decl(&self, field: &ModelField) -> syn::ItemFn {
        let ident = &field.ident;
        let ty = &field.ty;
        let value = field.into_transformed(parse_quote! { #ident });
        let statement = quote! { self.#ident = Some(#value) };
        parse_quote! {
            pub fn #ident(mut self, #ident: #ty) -> Self {
                #statement;
                self
            }
        }
    }

    fn builder_flat_fn_decl(&self, field: &ModelField) -> syn::ItemFn {
        let ident = &field.ident;
        let ty = &field.ty;
        let value = field.into_transformed(parse_quote! { #ident });
        let statement = quote! { self.#ident = #ident.map(|#ident| #value) };
        let name = syn::Ident::new(&format!("flat_{}", &field.builder_ident), Span::call_site());
        parse_quote! {
            pub fn #name(mut self, #ident: Option<#ty>) -> Self {
                #statement;
                self
            }
        }
    }
}

impl ToTokens for ChangesetBuilderImplBlock {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let ChangesetBuilderImplBlock { changeset, .. } = self;
        let field_fns = self
            .fields
            .iter()
            .map(|field| self.builder_field_fn_decl(field));
        let flat_fns = self
            .fields
            .iter()
            .map(|field| self.builder_flat_fn_decl(field));
        tokens.extend(quote! {
            impl #changeset {
                #(
                    #[allow(unused)]
                    #[must_use = "builder methods are intended to be chained"]
                    #field_fns
                )*
                #(
                    #[allow(unused)]
                    #[must_use = "builder methods are intended to be chained"]
                    #flat_fns
                )*
            }
        });
    }
}
