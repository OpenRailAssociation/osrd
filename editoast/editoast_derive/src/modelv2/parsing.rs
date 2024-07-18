use std::collections::{HashMap, HashSet};

use darling::Error;
use proc_macro2::Span;

use super::{
    args::{GeneratedTypeArgs, ModelArgs, ModelFieldArgs},
    identifier::{Identifier, RawIdentifier},
    FieldTransformation, Fields, ModelConfig, ModelField, DEFAULT_BATCH_CHUNK_SIZE_LIMIT,
};

impl ModelConfig {
    pub(crate) fn from_macro_args(
        options: ModelArgs,
        model_name: syn::Ident,
        visibility: syn::Visibility,
    ) -> darling::Result<Self> {
        let row = GeneratedTypeArgs {
            type_name: options.row.type_name.or(Some(format!("{}Row", model_name))),
            ..options.row
        };
        let changeset = GeneratedTypeArgs {
            type_name: options
                .changeset
                .type_name
                .or(Some(format!("{}Changeset", model_name))),
            ..options.changeset
        };

        // transform fields
        let fields = {
            let mut acc = Error::accumulator();
            let fields = options
                .data
                .take_struct()
                .ok_or(Error::custom("Model: only named structs are supported"))?
                .fields
                .into_iter()
                .filter_map(|field| acc.handle(ModelField::from_macro_args(field, &options.table)))
                .collect();
            acc.finish_with(fields)
        }?;
        let fields = Fields(fields);
        let first_field = &fields
            .first()
            .ok_or(Error::custom("Model: at least one field is required"))?
            .ident;
        let field_map: HashMap<_, _> = fields
            .iter()
            .map(|field| (field.ident.clone(), field.clone()))
            .collect();

        // collect identifiers from struct-level annotations...
        let mut raw_identfiers: HashSet<_> = options
            .identifiers
            .iter()
            .cloned()
            .chain(
                // ... and those at the field-level
                field_map
                    .values()
                    .filter(|field| field.identifier)
                    .map(|field| RawIdentifier::Field(field.ident.clone())),
            )
            .collect();

        // collect or infer the primary key field
        let primary_field = match field_map
            .values()
            .filter(|field| field.primary)
            .collect::<Vec<_>>()
            .as_slice()
        {
            [pf] => RawIdentifier::Field(pf.ident.clone()),
            [] => {
                let id = syn::Ident::new("id", Span::call_site());
                RawIdentifier::Field(
                    field_map
                        .get(&id)
                        .map(|f| f.ident.clone())
                        .unwrap_or_else(|| first_field.clone()),
                )
            }
            _ => return Err(Error::custom("Model: multiple primary fields found")),
        };

        // collect or infer the preferred identifier field
        let preferred_identifier = match (
            options.preferred.as_ref(),
            field_map
                .values()
                .filter(|field| field.primary)
                .collect::<Vec<_>>()
                .as_slice(),
        ) {
            (Some(id), []) => id.clone(),
            (None, [field]) => RawIdentifier::Field(field.ident.clone()),
            (None, []) => primary_field.clone(),
            _ => {
                return Err(Error::custom(
                    "Model: conflicting preferred field declarations",
                ))
            }
        };

        raw_identfiers.insert(primary_field.clone());
        raw_identfiers.insert(preferred_identifier.clone());

        let typed_identifiers = raw_identfiers
            .iter()
            .cloned()
            .map(|id| Identifier::new(id, &fields))
            .collect();
        let preferred_typed_identifier = Identifier::new(preferred_identifier.clone(), &fields);
        let primary_typed_identifier = Identifier::new(primary_field.clone(), &fields);

        Ok(Self {
            model: model_name,
            visibility,
            table: options.table,
            batch_chunk_size_limit: options
                .batch_chunk_size_limit
                .unwrap_or(DEFAULT_BATCH_CHUNK_SIZE_LIMIT),
            fields,
            row,
            changeset,
            identifiers: typed_identifiers,
            preferred_identifier: preferred_typed_identifier,
            primary_identifier: primary_typed_identifier,
        })
    }
}

impl ModelField {
    fn from_macro_args(value: ModelFieldArgs, table_mod: &syn::Path) -> darling::Result<Self> {
        let ident = value
            .ident
            .ok_or(Error::custom("Model: only works for named structs"))?;
        let column = value
            .column
            .unwrap_or_else(|| syn::parse_quote! { #table_mod::#ident });
        let builder_ident = value.builder_fn.unwrap_or_else(|| ident.clone());
        let to_enum = match value.to_enum {
            true => Some(value.ty.clone()),
            false => None,
        };

        let transform = FieldTransformation::from_args(
            value.remote,
            value.json,
            value.geo,
            value.to_string,
            to_enum,
        )
        .map_err(|e| e.with_span(&ident))?;
        Ok(Self {
            ident,
            builder_ident,
            column,
            ty: value.ty,
            builder_skip: value.builder_skip,
            identifier: value.identifier,
            preferred: value.preferred,
            primary: value.primary,
            transform,
        })
    }
}

impl FieldTransformation {
    fn from_args(
        remote: Option<syn::Type>,
        json: bool,
        geo: bool,
        to_string: bool,
        to_enum: Option<syn::Type>,
    ) -> darling::Result<Option<Self>> {
        match (remote, json, geo, to_string, to_enum) {
            (Some(ty), false, false, false, None) => Ok(Some(Self::Remote(ty))),
            (None, true, false, false, None) => Ok(Some(Self::Json)),
            (None, false, true, false, None) => Ok(Some(Self::Geo)),
            (None, false, false, true, None) => Ok(Some(Self::ToString)),
            (None, false, false, false, Some(ty)) => Ok(Some(Self::ToEnum(ty))),
            (None, false, false, false, None) => Ok(None),
            _ => Err(Error::custom(
                "Model: remote, json, geo, to_string and to_enum attributes are mutually exclusive",
            )),
        }
    }
}
