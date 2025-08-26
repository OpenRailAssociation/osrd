use std::collections::BTreeSet;
use std::ops::Deref;
use std::ops::DerefMut;

use darling::util::PathList;
use syn::parse_quote;

use super::args::ImplPlan;
use super::identifier::Identifier;
use super::identifier::RawIdentifier;

#[derive(Debug, PartialEq)]
pub(crate) struct ModelConfig {
    pub(crate) model: syn::Ident,
    pub(crate) visibility: syn::Visibility,
    pub(crate) table: syn::Path,
    pub(crate) batch_chunk_size_limit: usize,
    pub(crate) fields: Fields,
    pub(crate) row: Row,
    pub(crate) changeset: Changeset,
    pub(crate) field_wrapper: syn::Ident,
    pub(crate) errors: Errors,
    pub(crate) identifiers: BTreeSet<Identifier>, // identifiers ⊆ fields
    pub(crate) preferred_identifier: Identifier,  // preferred_identifier ∈ identifiers
    pub(crate) primary_identifier: Identifier,    // primary_identifier ∈ identifiers
    pub(crate) impl_plan: ImplPlan,
}

#[derive(Debug, PartialEq)]
pub(crate) struct Row {
    pub(crate) name: syn::Ident,
    pub(crate) derive: PathList,
    pub(crate) vis: syn::Visibility,
}

#[derive(Debug, PartialEq)]
pub(crate) struct Changeset {
    pub(crate) name: syn::Ident,
    pub(crate) derive: PathList,
    pub(crate) vis: syn::Visibility,
}

#[derive(Debug, PartialEq, Clone)]
pub(crate) struct ModelField {
    pub(crate) ident: syn::Ident,
    pub(crate) column: syn::Path,
    pub(crate) builder_ident: syn::Ident,
    pub(crate) ty: syn::Type,
    pub(crate) builder_skip: bool,
    pub(crate) identifier: bool,
    pub(crate) preferred: bool,
    pub(crate) primary: bool,
    pub(crate) transform: Option<FieldTransformation>,
}

#[derive(Debug, PartialEq, Clone)]
pub(crate) enum FieldTransformation {
    Remote(syn::Type),
    Json,
    Geo,
    ToString,
    ToEnum(syn::Type),
    UomUnit(syn::Path),
}

#[derive(Debug, PartialEq, Clone)]
pub(crate) struct Errors {
    pub(crate) create: syn::Path,
    pub(crate) retrieve: syn::Path,
    pub(crate) update: syn::Path,
    pub(crate) delete: syn::Path,
    pub(crate) list: syn::Path,
}

#[derive(Debug, PartialEq)]
pub(crate) struct Fields(pub(crate) Vec<ModelField>);

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
    pub(crate) fn get(&self, ident: &syn::Ident) -> Option<&ModelField> {
        self.iter().find(|field| &field.ident == ident)
    }
}

impl ModelConfig {
    pub(crate) fn iter_fields(&self) -> impl Iterator<Item = &ModelField> {
        self.fields.iter()
    }

    pub(crate) fn is_primary(&self, field: &ModelField) -> bool {
        field.ident == self.get_primary_field_ident()
    }

    pub(crate) fn table_name(&self) -> syn::Ident {
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

    pub(super) fn columns(&self) -> impl Iterator<Item = &syn::Ident> {
        self.fields.iter().map(ModelField::column_ident)
    }
}

impl Changeset {
    pub(crate) fn ident(&self) -> syn::Ident {
        self.name.clone()
    }
}

impl ModelField {
    pub(crate) fn has_transformation(&self) -> bool {
        self.transform.is_some()
    }

    #[allow(clippy::wrong_self_convention)]
    pub(crate) fn into_transformed(&self, expr: syn::Expr) -> syn::Expr {
        match self.transform {
            Some(FieldTransformation::Remote(_)) => parse_quote! { #expr.into() },
            Some(FieldTransformation::Json) => parse_quote! { diesel_json::Json(#expr) },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { #expr.to_string() },
            Some(FieldTransformation::ToEnum(_)) => {
                parse_quote! { #expr as i16 }
            }
            Some(FieldTransformation::UomUnit(ref unit)) => {
                parse_quote! { #unit::from(#expr) }
            }
            None => parse_quote! { #expr },
        }
    }

    #[allow(clippy::wrong_self_convention)]
    pub(crate) fn from_transformed(&self, expr: syn::Expr) -> syn::Expr {
        match self.transform {
            Some(FieldTransformation::Remote(_)) => parse_quote! { #expr.into() },
            Some(FieldTransformation::Json) => parse_quote! { #expr.0 },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { String::from(#expr.parse()) },
            Some(FieldTransformation::ToEnum(ref ty)) => {
                parse_quote! { #ty::from_repr(#expr as usize).expect("Invalid variant repr") }
            }
            Some(FieldTransformation::UomUnit(ref unit)) => {
                parse_quote! { #unit::new(#expr) }
            }
            None => parse_quote! { #expr },
        }
    }

    pub(crate) fn transform_type(&self) -> syn::Type {
        let ty = &self.ty;
        match self.transform {
            Some(FieldTransformation::Remote(ref ty)) => parse_quote! { #ty },
            Some(FieldTransformation::Json) => parse_quote! { diesel_json::Json<#ty> },
            Some(FieldTransformation::Geo) => unimplemented!("to be designed"),
            Some(FieldTransformation::ToString) => parse_quote! { String },
            Some(FieldTransformation::ToEnum(_)) => parse_quote! { i16 },
            Some(FieldTransformation::UomUnit(ref unit)) => parse_quote! { #unit::ReprType },
            None => ty.clone(),
        }
    }

    pub(crate) fn column_ident(&self) -> &syn::Ident {
        &self
            .column
            .segments
            .last()
            .expect("Model: invalid empty column")
            .ident
    }
}
