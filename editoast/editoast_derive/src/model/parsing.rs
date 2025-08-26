use std::collections::HashMap;
use std::collections::HashSet;

use darling::Error;
use proc_macro2::Span;

use super::DEFAULT_BATCH_CHUNK_SIZE_LIMIT;
use super::FieldTransformation;
use super::Fields;
use super::ModelConfig;
use super::ModelField;
use super::args::DetailedErrorArgs;
use super::args::ErrorArgs;
use super::args::GeneratedTypeArgs;
use super::args::ImplPlan;
use super::args::ModelArgs;
use super::args::ModelFieldArgs;
use super::args::RwErrorArgs;
use super::config::Changeset;
use super::config::Errors;
use super::config::Row;
use super::crud::Crud;
use super::identifier::Identifier;
use super::identifier::RawIdentifier;

impl ImplPlan {
    fn generates_something(&self) -> bool {
        self.ops != Crud::default() || self.batch_ops != Crud::default() || self.list
    }
}

impl ModelConfig {
    pub(crate) fn from_macro_args(
        options: ModelArgs,
        model_name: syn::Ident,
        visibility: syn::Visibility,
    ) -> darling::Result<Self> {
        if !options.impl_plan.generates_something() {
            return Err(Error::custom(
                "Model: at least one operation must be generated",
            ));
        }

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
                .collect::<Vec<_>>();
            acc.finish_with(fields)
        }?;
        let first_field = fields
            .first()
            .ok_or(Error::custom("Model: at least one field is required"))?
            .ident
            .clone();
        let fields_order = fields
            .iter()
            .map(|field| field.ident.clone())
            .collect::<Vec<_>>();
        let mut field_map: HashMap<_, _> = fields
            .into_iter()
            .map(|field| (field.ident.clone(), field))
            .collect();

        // collect identifiers from struct-level annotations...
        let mut raw_identifiers: HashSet<_> = options
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
        let primary_field = {
            let id = match field_map
                .values()
                .filter(|field| field.primary)
                .collect::<Vec<_>>()
                .as_slice()
            {
                [pf] => &pf.ident,
                [] => {
                    let id = syn::Ident::new("id", Span::call_site());
                    field_map
                        .get(&id)
                        .map(|f| &f.ident)
                        .unwrap_or_else(|| &first_field)
                }
                _ => return Err(Error::custom("Model: multiple primary fields found")),
            }
            .clone();
            field_map.get_mut(&id).unwrap().primary = true;
            RawIdentifier::Field(id)
        };

        // collect or infer the preferred identifier field
        let (preferred_identifier, ident) = match (
            options.preferred.as_ref(),
            field_map
                .values()
                .filter(|field| field.preferred)
                .collect::<Vec<_>>()
                .as_slice(),
        ) {
            (Some(RawIdentifier::Field(ident)), []) => {
                (RawIdentifier::Field(ident.clone()), Some(ident.clone()))
            }
            (Some(id), []) => (id.clone(), None),
            (None, [field]) => (
                RawIdentifier::Field(field.ident.clone()),
                Some(field.ident.clone()),
            ),
            (None, []) => (primary_field.clone(), None),
            _ => {
                return Err(Error::custom(
                    "Model: conflicting preferred field declarations",
                ));
            }
        };
        if let Some(ident) = ident.as_ref() {
            field_map.get_mut(ident).unwrap().preferred = true;
        }

        raw_identifiers.insert(primary_field.clone());
        raw_identifiers.insert(preferred_identifier.clone());

        let fields = Fields(
            fields_order
                .iter()
                .map(|id| field_map.remove(id).unwrap())
                .collect(),
        );

        let typed_identifiers = raw_identifiers
            .iter()
            .cloned()
            .map(|id| Identifier::new(id, &fields))
            .collect();
        let preferred_typed_identifier = Identifier::new(preferred_identifier.clone(), &fields);
        let primary_typed_identifier = Identifier::new(primary_field, &fields);

        let impl_plan = options.impl_plan;

        if fields.len() == 1 && fields.first().unwrap().primary {
            if impl_plan.ops.update || impl_plan.batch_ops.update {
                return Err(Error::custom(
                    "Model: update operations are not supported for single primary key models",
                ));
            }

            if impl_plan.batch_ops.create {
                return Err(Error::custom(
                    "Model: batch create operations are not supported for single primary key models — PR welcomed",
                ));
            }

            if options.changeset.type_name.is_some() && !options.changeset.derive.is_empty() {
                return Err(Error::custom(
                    "Model: changeset configuration found but Unit is the changeset of single PK Models",
                ));
            }
        }

        let row = {
            let GeneratedTypeArgs {
                type_name,
                derive,
                public,
            } = options.row;
            Row {
                name: type_name.unwrap_or(syn::Ident::new(
                    &format!("{model_name}Row"),
                    Span::call_site(),
                )),
                derive,
                vis: if public {
                    syn::Visibility::Public(Default::default())
                } else {
                    syn::Visibility::Inherited
                },
            }
        };
        let changeset = {
            let GeneratedTypeArgs {
                type_name,
                derive,
                public,
            } = options.changeset;
            let vis = if public {
                syn::Visibility::Public(Default::default())
            } else {
                syn::Visibility::Inherited
            };
            Changeset {
                name: type_name.unwrap_or(syn::Ident::new(
                    &format!("{model_name}Changeset"),
                    Span::call_site(),
                )),
                derive,
                vis,
            }
        };
        let field_wrapper = syn::Ident::new(&format!("_{model_name}Field"), Span::call_site());

        let model_config = Self {
            model: model_name,
            visibility,
            table: options.table,
            batch_chunk_size_limit: options
                .batch_chunk_size_limit
                .unwrap_or(DEFAULT_BATCH_CHUNK_SIZE_LIMIT),
            impl_plan,
            fields,
            row,
            changeset,
            field_wrapper,
            errors: options
                .error
                .map(Errors::from_args)
                .unwrap_or_else(|| Ok(Errors::default()))?,
            identifiers: typed_identifiers,
            preferred_identifier: preferred_typed_identifier,
            primary_identifier: primary_typed_identifier,
        };

        Ok(model_config)
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
            value.uom_unit,
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
        uom_unit: Option<syn::Path>,
    ) -> darling::Result<Option<Self>> {
        match (remote, json, geo, to_string, to_enum, uom_unit) {
            (Some(ty), false, false, false, None, None) => Ok(Some(Self::Remote(ty))),
            (None, true, false, false, None, None) => Ok(Some(Self::Json)),
            (None, false, true, false, None, None) => Ok(Some(Self::Geo)),
            (None, false, false, true, None, None) => Ok(Some(Self::ToString)),
            (None, false, false, false, Some(ty), None) => Ok(Some(Self::ToEnum(ty))),
            (None, false, false, false, None, Some(ty)) => Ok(Some(Self::UomUnit(ty))),
            (None, false, false, false, None, None) => Ok(None),
            _ => Err(Error::custom(
                "Model: remote, json, geo, to_string, to_enum and uom_unit attributes are mutually exclusive",
            )),
        }
    }
}

impl Errors {
    fn from_args(args: ErrorArgs) -> darling::Result<Self> {
        match args {
            ErrorArgs::Single(path) => Ok(Self {
                create: path.clone(),
                retrieve: path.clone(),
                update: path.clone(),
                delete: path.clone(),
                list: path,
            }),
            ErrorArgs::Rw(RwErrorArgs { read, write, .. }) => {
                let Errors {
                    retrieve, create, ..
                } = Errors::default();
                let read = read.unwrap_or(retrieve);
                let write = write.unwrap_or(create);
                Ok(Self {
                    retrieve: read.clone(),
                    create: write.clone(),
                    update: write.clone(),
                    delete: write,
                    list: read,
                })
            }
            ErrorArgs::Detailed(DetailedErrorArgs {
                create,
                retrieve,
                update,
                delete,
                list,
            }) => {
                let Errors {
                    create: default_create,
                    retrieve: default_retrieve,
                    update: default_update,
                    delete: default_delete,
                    list: default_list,
                } = Errors::default();
                Ok(Self {
                    retrieve: retrieve.unwrap_or(default_retrieve),
                    create: create.unwrap_or(default_create),
                    update: update.unwrap_or(default_update),
                    delete: delete.unwrap_or(default_delete),
                    list: list.unwrap_or(default_list),
                })
            }
        }
    }
}

impl Default for Errors {
    fn default() -> Self {
        Self {
            create: syn::parse_quote! { editoast_models::Error },
            retrieve: syn::parse_quote! { editoast_models::Error },
            update: syn::parse_quote! { editoast_models::Error },
            delete: syn::parse_quote! { editoast_models::Error },
            list: syn::parse_quote! { editoast_models::Error },
        }
    }
}
