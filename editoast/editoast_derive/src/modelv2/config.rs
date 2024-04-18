use std::{
    collections::HashSet,
    ops::{Deref, DerefMut},
};

use syn::parse_quote;

use super::{
    args::GeneratedTypeArgs,
    identifier::{Identifier, TypedIdentifier},
};

#[derive(Debug, PartialEq)]
pub struct ModelConfig {
    pub model: syn::Ident,
    pub visibility: syn::Visibility,
    pub table: syn::Path,
    pub fields: Fields,
    pub row: GeneratedTypeArgs,
    pub changeset: GeneratedTypeArgs,
    pub identifiers: HashSet<Identifier>, // identifiers ⊆ fields
    pub preferred_identifier: Identifier, // preferred_identifier ∈ identifiers
    pub primary_field: Identifier,        // primary_field ∈ identifiers
    // NOTE: duplication is temporary, will replace plain identifers once
    // the ToTokens refactoring is complete
    pub(crate) typed_identifiers: HashSet<TypedIdentifier>,
    pub(crate) preferred_typed_identifier: TypedIdentifier,
    pub(crate) primary_typed_identifier: TypedIdentifier,
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

    pub fn type_expr(&self, config: &ModelConfig) -> syn::Type {
        match self {
            Self::Field(_) => self.get_field(config).unwrap().ty.clone(),
            Self::Compound(idents) => {
                let ty = idents
                    .iter()
                    .map(|ident| &config.fields.get(ident).unwrap().ty);
                syn::parse_quote! { (#(#ty),*) } // tuple type
            }
        }
    }
}

impl ModelConfig {
    pub fn iter_fields(&self) -> impl Iterator<Item = &ModelField> {
        self.fields.iter()
    }

    pub fn is_primary(&self, field: &ModelField) -> bool {
        match &self.primary_field {
            Identifier::Field(ident) => ident == &field.ident,
            Identifier::Compound(_) => false,
        }
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
        match &self.primary_typed_identifier.identifier {
            Identifier::Field(ident) => ident.clone(),
            Identifier::Compound(_) => panic!("Model: compound primary field should be impossible"),
        }
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
