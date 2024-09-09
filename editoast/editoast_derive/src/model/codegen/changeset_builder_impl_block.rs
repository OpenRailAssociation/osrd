use proc_macro2::Span;
use proc_macro2::TokenStream;
use quote::quote;
use quote::ToTokens;
use syn::parse_quote;

use crate::model::ModelField;

pub(super) enum BuilderType {
    Changeset,
    Patch,
}

pub(crate) struct ChangesetBuilderImplBlock {
    pub(super) builder_type: BuilderType,
    pub(super) model: syn::Ident,
    pub(super) changeset: syn::Ident,
    pub(super) fields: Vec<ModelField>,
}

impl ChangesetBuilderImplBlock {
    fn impl_decl(&self) -> TokenStream {
        let Self {
            model, changeset, ..
        } = self;
        match self.builder_type {
            BuilderType::Changeset => quote! { impl #changeset },
            BuilderType::Patch => quote! {  impl<'a> crate::models::Patch<'a, #model> },
        }
    }

    fn builder_field_fn_decl(&self, field: &ModelField) -> syn::ItemFn {
        let ident = &field.ident;
        let ty = &field.ty;
        let value = field.into_transformed(parse_quote! { #ident });
        let statement = match self.builder_type {
            BuilderType::Changeset => quote! { self.#ident = Some(#value) },
            BuilderType::Patch => quote! { self.changeset.#ident = Some(#value) },
        };
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
        let statement = match self.builder_type {
            BuilderType::Changeset => quote! { self.#ident = #ident.map(|#ident| #value) },
            BuilderType::Patch => quote! { self.changeset.#ident = #ident.map(|#ident| #value) },
        };
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
        let impl_decl = self.impl_decl();
        let field_fns = self
            .fields
            .iter()
            .map(|field| self.builder_field_fn_decl(field));
        let flat_fns = self
            .fields
            .iter()
            .map(|field| self.builder_flat_fn_decl(field));
        tokens.extend(quote! {
            #[automatically_derived]
            #impl_decl {
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
