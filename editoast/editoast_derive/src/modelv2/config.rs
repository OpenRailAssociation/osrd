use std::{
    collections::HashSet,
    ops::{Deref, DerefMut},
};

use proc_macro2::TokenStream;
use quote::quote;

use super::{args::GeneratedTypeArgs, identifier::Identifier};

#[derive(Debug, PartialEq)]
pub struct ModelConfig {
    pub model: syn::Ident,
    pub table: syn::Path,
    pub fields: Fields,
    pub row: GeneratedTypeArgs,
    pub changeset: GeneratedTypeArgs,
    pub identifiers: HashSet<Identifier>, // identifiers ⊆ fields
    pub preferred_identifier: Identifier, // preferred_identifier ∈ identifiers
    pub primary_field: Identifier,        // primary_field ∈ identifiers
}

#[derive(Debug, PartialEq, Clone)]
pub struct ModelField {
    pub ident: syn::Ident,
    pub column: String,
    pub builder_ident: syn::Ident,
    pub ty: syn::Type,
    pub builder_skip: bool,
    pub identifier: bool,
    pub preferred: bool,
    pub primary: bool,
    pub transform: Option<FieldTransformation>,
}

#[derive(Debug, PartialEq, Clone)]
pub enum FieldTransformation {
    Remote(syn::Type),
    Json,
    Geo,
    ToString,
    ToEnum(syn::Type),
}

#[derive(Debug, PartialEq)]
pub struct Fields(pub Vec<ModelField>);

impl Deref for Fields {
    type Target = Vec<ModelField>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Fields {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl Fields {
    pub fn get(&self, ident: &syn::Ident) -> Option<&ModelField> {
        self.iter().find(|field| &field.ident == ident)
    }
}

impl Identifier {
    pub fn get_field<'a>(&self, config: &'a ModelConfig) -> Option<&'a ModelField> {
        match self {
            Self::Field(ident) => config.fields.get(ident),
            Self::Compound(_) => None,
        }
    }

    pub fn type_expr(&self, config: &ModelConfig) -> TokenStream {
        match self {
            Self::Field(_) => {
                let ty = &self.get_field(config).unwrap().ty;
                quote! { #ty }
            }
            Self::Compound(idents) => {
                let ty = idents
                    .iter()
                    .map(|ident| &config.fields.get(ident).unwrap().ty);
                quote! { (#(#ty),*) }
            }
        }
    }
}
