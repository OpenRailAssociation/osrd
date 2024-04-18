use std::{
    collections::HashSet,
    ops::{Deref, DerefMut},
};

use syn::parse_quote;

use super::{
    args::GeneratedTypeArgs,
    identifier::{Identifier, RawIdentifier},
};

#[derive(Debug, PartialEq)]
pub struct ModelConfig {
    pub model: syn::Ident,
    pub visibility: syn::Visibility,
    pub table: syn::Path,
    pub fields: Fields,
    pub row: GeneratedTypeArgs,
    pub changeset: GeneratedTypeArgs,
    pub(crate) identifiers: HashSet<Identifier>, // identifiers ⊆ fields
    pub(crate) preferred_identifier: Identifier, // preferred_identifier ∈ identifiers
    pub(crate) primary_identifier: Identifier,   // primary_identifier ∈ identifiers
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

impl ModelConfig {
    pub fn iter_fields(&self) -> impl Iterator<Item = &ModelField> {
        self.fields.iter()
    }

    pub fn is_primary(&self, field: &ModelField) -> bool {
        field.ident == self.get_primary_field_ident()
    }

    pub fn table_name(&self) -> syn::Ident {
        let table = self
            .table
            .segments
            .last()
            .expect("Model: invalid table value");
        table.ident.clone()
    }

    pub(super) fn get_primary_field_ident(&self) -> syn::Ident {
        match &self.primary_identifier.raw {
            RawIdentifier::Field(ident) => ident.clone(),
            RawIdentifier::Compound(_) => {
                panic!("Model: compound primary field should be impossible")
            }
        }
    }

    pub(super) fn get_primary_field_column(&self) -> syn::Ident {
        match self.primary_identifier.columns.as_slice() {
            [column] => column.clone(),
            [] => panic!("Model: primary field should have exactly one column"),
            _ => panic!("Model: compound primary field should be impossible"),
        }
    }

    pub(super) fn changeset_fields(&self) -> impl Iterator<Item = &ModelField> {
        self.fields
            .iter()
            .filter(|field| !self.is_primary(field))
            .filter(|field| !field.builder_skip)
    }
}

impl ModelField {
    #[allow(clippy::wrong_self_convention)]
    pub fn into_transformed(&self, expr: syn::Expr) -> syn::Expr {
        match self.transform {
            Some(FieldTransformation::Remote(_)) => parse_quote! { #expr.into() },
            Some(FieldTransformation::Json) => parse_quote! { diesel_json::Json(#expr) },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { #expr.to_string() },
            Some(FieldTransformation::ToEnum(_)) => {
                parse_quote! { #expr as i16 }
            }
            None => parse_quote! { #expr },
        }
    }

    #[allow(clippy::wrong_self_convention)]
    pub fn from_transformed(&self, expr: syn::Expr) -> syn::Expr {
        match self.transform {
            Some(FieldTransformation::Remote(_)) => parse_quote! { #expr.into() },
            Some(FieldTransformation::Json) => parse_quote! { #expr.0 },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { String::from(#expr.parse()) },
            Some(FieldTransformation::ToEnum(ref ty)) => {
                parse_quote! { #ty::from_repr(#expr as usize).expect("Invalid variant repr") }
            }
            None => parse_quote! { #expr },
        }
    }

    pub fn transform_type(&self) -> syn::Type {
        let ty = &self.ty;
        match self.transform {
            Some(FieldTransformation::Remote(ref ty)) => parse_quote! { #ty },
            Some(FieldTransformation::Json) => parse_quote! { diesel_json::Json<#ty> },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { String },
            Some(FieldTransformation::ToEnum(_)) => parse_quote! { i16 },
            None => ty.clone(),
        }
    }

    pub(super) fn column_ident(&self) -> syn::Ident {
        syn::Ident::new(&self.column, self.ident.span())
    }
}
