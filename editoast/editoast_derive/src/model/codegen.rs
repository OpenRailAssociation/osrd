mod changeset_builder_impl_block;
mod changeset_decl;
mod changeset_from_model;
mod count_impl;
mod create_batch_impl;
mod create_batch_with_key_impl;
mod create_impl;
mod delete_batch_impl;
mod delete_impl;
mod delete_static_impl;
mod exists_impl;
mod field_wrapper_decl;
mod identifiable_impl;
mod list_impl;
mod model_field_api_impl_block;
mod model_fields_impl_block;
mod model_from_row_impl;
mod model_impl;
mod preferred_id_impl;
mod retrieve_batch_impl;
mod retrieve_impl;
mod row_decl;
mod update_batch_impl;
mod update_impl;

use quote::ToTokens;
use syn::parse_quote;

use crate::model::codegen::field_wrapper_decl::FieldWrapperDecl;

use self::changeset_builder_impl_block::ChangesetBuilderImplBlock;
use self::changeset_decl::ChangesetDecl;
use self::changeset_decl::ChangesetFieldDecl;
use self::changeset_from_model::ChangesetFromModelImpl;
use self::count_impl::CountImpl;
use self::create_batch_impl::CreateBatchImpl;
use self::create_batch_with_key_impl::CreateBatchWithKeyImpl;
use self::create_impl::CreateImpl;
use self::delete_batch_impl::DeleteBatchImpl;
use self::delete_impl::DeleteImpl;
use self::delete_static_impl::DeleteStaticImpl;
use self::exists_impl::ExistsImpl;
use self::identifiable_impl::IdentifiableImpl;
use self::list_impl::ListImpl;
use self::model_field_api_impl_block::ModelFieldApiImplBlock;
use self::model_fields_impl_block::ModelFieldDecl;
use self::model_fields_impl_block::ModelFieldsImplBlock;
use self::model_from_row_impl::ModelFromRowImpl;
use self::model_impl::ModelImpl;
use self::preferred_id_impl::PreferredIdImpl;
use self::retrieve_batch_impl::RetrieveBatchImpl;
use self::retrieve_impl::RetrieveImpl;
use self::row_decl::RowDecl;
use self::row_decl::RowFieldDecl;
use self::update_batch_impl::UpdateBatchImpl;
use self::update_impl::UpdateImpl;

use super::ModelConfig;
use super::RawIdentifier;
use super::args::ImplPlan;
use super::config::Changeset;
use super::identifier::Identifier;
use super::utils::np;

impl RawIdentifier {
    fn get_ident_lvalue(&self) -> syn::Expr {
        match self {
            Self::Field(ident) => parse_quote! { #ident },
            Self::Compound(idents) => {
                parse_quote! { (#(#idents),*) }
            }
        }
    }

    fn get_ref_ident_lvalue(&self) -> syn::Expr {
        match self {
            Self::Field(ident) => parse_quote! { &#ident },
            Self::Compound(idents) => {
                parse_quote! { (#(&#idents),*) }
            }
        }
    }
}

impl Identifier {
    fn get_type(&self) -> syn::Type {
        let ty = self.field_types.iter();
        syn::parse_quote! { (#(#ty),*) } // tuple type
    }

    fn get_lvalue(&self) -> syn::Expr {
        self.raw.get_ident_lvalue()
    }

    fn get_ref_lvalue(&self) -> syn::Expr {
        self.raw.get_ref_ident_lvalue()
    }

    fn get_diesel_eqs(&self) -> Vec<syn::Expr> {
        self.get_idents()
            .iter()
            .zip(&self.columns)
            .map(|(ident, column)| parse_quote! { dsl::#column.eq(#ident) })
            .collect()
    }

    fn get_diesel_eq_and_fold(&self) -> syn::Expr {
        let mut idents = self.get_idents().into_iter().zip(&self.columns).rev();
        let (first_ident, first_column) = idents.next().expect("Identifiers cannot be empty");
        idents.fold(
            parse_quote! { dsl::#first_column.eq(#first_ident) },
            |acc, (ident, column)| {
                parse_quote! { dsl::#column.eq(#ident).and(#acc) }
            },
        )
    }
}

impl ImplPlan {
    fn has_read(&self) -> bool {
        self.ops.read || self.batch_ops.read
    }

    fn has_create(&self) -> bool {
        self.ops.create || self.batch_ops.create
    }

    fn has_update(&self) -> bool {
        self.ops.update || self.batch_ops.update
    }

    fn has_upsert(&self) -> bool {
        self.has_update() || self.has_create()
    }
}

impl ModelConfig {
    pub(crate) fn model_impl(&self) -> ModelImpl {
        ModelImpl {
            model: self.model.clone(),
            row: self.row.name.clone(),
            changeset: self.changeset.ident(),
            table: self.table.clone(),
        }
    }

    pub(crate) fn field_wrapper_decl(&self) -> FieldWrapperDecl {
        FieldWrapperDecl {
            vis: self.visibility.clone(),
            ident: self.field_wrapper.clone(),
        }
    }

    pub(crate) fn model_fields_impl_block(&self) -> ModelFieldsImplBlock {
        ModelFieldsImplBlock {
            model: self.model.clone(),
            fields: self
                .iter_fields()
                .map(|field| ModelFieldDecl {
                    name: field.ident.clone(),
                    ty: field.ty.clone(),
                    column: field.column.clone(),
                })
                .collect(),
            field_wrapper: self.field_wrapper.clone(),
        }
    }

    pub(crate) fn model_field_api_impl_blocks(&self) -> Vec<Option<ModelFieldApiImplBlock>> {
        self.iter_fields()
            .map(|field| {
                ModelFieldApiImplBlock {
                    model: self.model.clone(),
                    field: field.clone(),
                    field_wrapper: self.field_wrapper.clone(),
                }
                .tokens_if(self.impl_plan.list)
            })
            .collect()
    }

    pub(crate) fn row_decl(&self) -> RowDecl {
        RowDecl {
            vis: self.visibility.clone(),
            ident: self.row.name.clone(),
            table: self.table.clone(),
            additional_derives: self.row.derive.clone(),
            fields: self
                .iter_fields()
                .map(|field| RowFieldDecl {
                    vis: self.row.vis.clone(),
                    name: field.ident.clone(),
                    ty: field.transform_type(),
                    column_name: field.column_ident().to_string(),
                })
                .collect(),
        }
    }

    pub(crate) fn changeset_decl(&self) -> ChangesetDecl {
        let Changeset { name, derive, vis } = &self.changeset;
        ChangesetDecl {
            vis: self.visibility.clone(),
            ident: name.clone(),
            table: self.table.clone(),
            additional_derives: derive.clone(),
            fields: self
                .changeset_fields()
                .map(|field| ChangesetFieldDecl {
                    vis: vis.clone(),
                    name: field.ident.clone(),
                    ty: field.transform_type(),
                    column_name: field.column_ident().to_string(),
                })
                .collect(),
        }
    }

    pub(crate) fn changeset_builder_impl_block(&self) -> Option<ChangesetBuilderImplBlock> {
        ChangesetBuilderImplBlock {
            changeset: self.changeset.ident(),
            fields: self.changeset_fields().cloned().collect(),
        }
        .tokens_if(self.impl_plan.has_upsert())
    }

    pub(crate) fn identifiable_impls(&self) -> Vec<IdentifiableImpl> {
        self.identifiers
            .iter()
            .map(|identifier| IdentifiableImpl {
                model: self.model.clone(),
                ty: identifier.get_type(),
                fields: identifier.get_idents(),
            })
            .collect()
    }

    pub(crate) fn preferred_id_impl(&self) -> PreferredIdImpl {
        PreferredIdImpl {
            model: self.model.clone(),
            ty: self.preferred_identifier.get_type(),
        }
    }

    pub(crate) fn model_from_row_impl(&self) -> ModelFromRowImpl {
        ModelFromRowImpl {
            model: self.model.clone(),
            row: self.row.name.clone(),
            fields: self.fields.clone(),
        }
    }

    pub(crate) fn changeset_from_model_impl(&self) -> ChangesetFromModelImpl {
        ChangesetFromModelImpl {
            model: self.model.clone(),
            changeset: self.changeset.ident(),
            fields: self.changeset_fields().cloned().collect(),
        }
    }

    pub(crate) fn retrieve_impls(&self) -> Vec<Option<RetrieveImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                RetrieveImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    row: self.row.name.clone(),
                    identifier: identifier.clone(),
                    columns: self.columns().cloned().collect(),
                    error: self.errors.retrieve.clone(),
                }
                .tokens_if(self.impl_plan.ops.read)
            })
            .collect()
    }

    pub(crate) fn exists_impls(&self) -> Vec<Option<ExistsImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                ExistsImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    identifier: identifier.clone(),
                    error: self.errors.retrieve.clone(),
                }
                .tokens_if(self.impl_plan.has_read())
            })
            .collect()
    }

    pub(crate) fn update_impls(&self) -> Vec<Option<UpdateImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                UpdateImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    row: self.row.name.clone(),
                    changeset: self.changeset.ident(),
                    identifier: identifier.clone(),
                    columns: self.columns().cloned().collect(),
                    error: self.errors.update.clone(),
                }
                .tokens_if(self.impl_plan.ops.update)
            })
            .collect()
    }

    pub(crate) fn delete_static_impls(&self) -> Vec<Option<DeleteStaticImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                DeleteStaticImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    identifier: identifier.clone(),
                    error: self.errors.delete.clone(),
                }
                .tokens_if(self.impl_plan.ops.delete)
            })
            .collect()
    }

    pub(crate) fn create_impl(&self) -> Option<CreateImpl> {
        CreateImpl {
            model: self.model.clone(),
            table_mod: self.table.clone(),
            row: self.row.name.clone(),
            changeset: self.changeset.ident(),
            empty_changeset: self.changeset_fields().next().is_none(),
            columns: self.columns().cloned().collect(),
            error: self.errors.create.clone(),
        }
        .tokens_if(self.impl_plan.ops.create)
    }

    pub(crate) fn delete_impl(&self) -> Option<DeleteImpl> {
        DeleteImpl {
            model: self.model.clone(),
            table_mod: self.table.clone(),
            primary_key: self.get_primary_field_ident(),
            error: self.errors.delete.clone(),
        }
        .tokens_if(self.impl_plan.ops.delete)
    }

    pub(crate) fn list_impl(&self) -> Option<ListImpl> {
        ListImpl {
            model: self.model.clone(),
            table_mod: self.table.clone(),
            row: self.row.name.clone(),
            columns: self.columns().cloned().collect(),
            error: self.errors.list.clone(),
        }
        .tokens_if(self.impl_plan.list)
    }

    pub(crate) fn count_impl(&self) -> Option<CountImpl> {
        CountImpl {
            model: self.model.clone(),
            table_mod: self.table.clone(),
            error: self.errors.list.clone(),
        }
        .tokens_if(self.impl_plan.list)
    }

    pub(crate) fn create_batch_impl(&self) -> Option<CreateBatchImpl> {
        CreateBatchImpl {
            model: self.model.clone(),
            table_name: self.table_name(),
            table_mod: self.table.clone(),
            chunk_size_limit: self.batch_chunk_size_limit,
            row: self.row.name.clone(),
            changeset: self.changeset.ident(),
            field_count: self.changeset_fields().count(),
            columns: self.columns().cloned().collect(),
            error: self.errors.create.clone(),
        }
        .tokens_if(self.impl_plan.batch_ops.create)
    }

    pub(crate) fn create_batch_with_key_impls(&self) -> Vec<Option<CreateBatchWithKeyImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                CreateBatchWithKeyImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    chunk_size_limit: self.batch_chunk_size_limit,
                    row: self.row.name.clone(),
                    changeset: self.changeset.ident(),
                    identifier: identifier.clone(),
                    field_count: self.changeset_fields().count(),
                    columns: self.columns().cloned().collect(),
                    error: self.errors.create.clone(),
                }
                .tokens_if(self.impl_plan.batch_ops.create)
            })
            .collect()
    }

    pub(crate) fn retrieve_batch_impls(&self) -> Vec<Option<RetrieveBatchImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                RetrieveBatchImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    chunk_size_limit: self.batch_chunk_size_limit,
                    row: self.row.name.clone(),
                    identifier: identifier.clone(),
                    columns: self.columns().cloned().collect(),
                    error: self.errors.retrieve.clone(),
                }
                .tokens_if(self.impl_plan.batch_ops.read)
            })
            .collect()
    }

    pub(crate) fn update_batch_impls(&self) -> Vec<Option<UpdateBatchImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                UpdateBatchImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    chunk_size_limit: self.batch_chunk_size_limit,
                    row: self.row.name.clone(),
                    changeset: self.changeset.ident(),
                    identifier: identifier.clone(),
                    primary_key_column: self.get_primary_field_column(),
                    columns: self.columns().cloned().collect(),
                    error: self.errors.update.clone(),
                }
                .tokens_if(self.impl_plan.batch_ops.update)
            })
            .collect()
    }

    pub(crate) fn delete_batch_impls(&self) -> Vec<Option<DeleteBatchImpl>> {
        self.identifiers
            .iter()
            .map(|identifier| {
                DeleteBatchImpl {
                    model: self.model.clone(),
                    table_name: self.table_name(),
                    table_mod: self.table.clone(),
                    chunk_size_limit: self.batch_chunk_size_limit,
                    identifier: identifier.clone(),
                    error: self.errors.delete.clone(),
                }
                .tokens_if(self.impl_plan.batch_ops.delete)
            })
            .collect()
    }
}

trait TokensIf: Sized {
    fn tokens_if(self, condition: bool) -> Option<Self> {
        if condition { Some(self) } else { None }
    }
}

impl<T: ToTokens> TokensIf for T {}

/// Generates an expression that splits a query into chunks to accommodate libpq's maximum number of binded parameters
///
/// This is a hack around a libpq limitation (cf. <https://github.com/diesel-rs/diesel/issues/2414>).
/// The rows to process are split into chunks for which at most `2^16 - 1` parameters are sent to libpq.
/// Therefore we need to know how many parameters are sent per row.
/// The result collection can be parametrized.
///
/// # On concurrency
///
/// There seem to be a problem with concurrent queries using deadpool, panicking with
/// 'Cannot access shared transaction state'. So this macro do not run each chunk's query concurrently.
/// While AsyncPgConnection supports pipelining, each query will be sent one after the other.
/// (But hey, it's still better than just making one query per row :p)
#[derive(Clone)]
struct LibpqChunkedIteration {
    /// The number of binded values per row
    parameters_per_row: usize,
    /// The maximum number of rows per chunk (actual chunk size may be smaller, but never bigger)
    chunk_size_limit: usize,
    /// The identifier of the values to iterate over (must implement `IntoIterator<Item = ParameterType>`)
    values_ident: syn::Ident,
    /// How to collect the results
    collector: LibpqChunkedIterationCollector,
    /// The identifier of the chunk iteration variable
    chunk_iteration_ident: syn::Ident,
    /// The body of the chunk iteration
    chunk_iteration_body: proc_macro2::TokenStream,
}

/// Describes how to collect the results of a chunked iteration
#[derive(Clone)]
enum LibpqChunkedIterationCollector {
    /// All results are pushed into a Vec (item type has to be inferable)
    VecPush,
    /// Extends an existing collection. It's initialization expression must be provided.
    ///
    /// The initialized collection must implement `Extend<Model>`.
    Extend { collection_init: syn::Expr },
}

impl LibpqChunkedIteration {
    fn with_iteration_body(&self, body: proc_macro2::TokenStream) -> Self {
        Self {
            chunk_iteration_body: body,
            ..self.clone()
        }
    }
}

impl ToTokens for LibpqChunkedIteration {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            parameters_per_row,
            chunk_size_limit,
            values_ident,
            chunk_iteration_ident,
            chunk_iteration_body,
            collector,
        } = self;
        let (init, extend) = match collector {
            LibpqChunkedIterationCollector::VecPush => {
                (syn::parse_quote! { Vec::new() }, quote::quote! { push })
            }
            LibpqChunkedIterationCollector::Extend { collection_init } => {
                (collection_init.clone(), quote::quote! { extend })
            }
        };
        tokens.extend(quote::quote! {
            const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
            // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
            const ASYNC_SUBDIVISION: usize = 2_usize;
            const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / #parameters_per_row;
            let mut result = #init;
            let chunks = #values_ident.chunks(CHUNK_SIZE.min(#chunk_size_limit));
            for #chunk_iteration_ident in chunks {
                let chunk_result = { #chunk_iteration_body };
                result.#extend(chunk_result);
            }
            result
        });
    }
}
