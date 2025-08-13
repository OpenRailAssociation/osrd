#![allow(clippy::manual_unwrap_or_default)]

use super::RawIdentifier;
use super::crud::Crud;
use darling::FromDeriveInput;
use darling::FromField;
use darling::FromMeta;
use darling::ast;
use darling::util::PathList;
use darling::util::{self};

#[derive(FromDeriveInput, Debug)]
#[darling(
    attributes(model),
    forward_attrs(allow, doc, cfg),
    supports(struct_named)
)]
pub(super) struct ModelArgs {
    pub(super) table: syn::Path,
    #[darling(default)]
    pub(super) row: GeneratedTypeArgs,
    #[darling(default)]
    pub(super) changeset: GeneratedTypeArgs,
    #[darling(default)]
    pub(super) error: Option<ErrorArgs>,
    #[darling(multiple, rename = "identifier")]
    pub(super) identifiers: Vec<RawIdentifier>,
    #[darling(rename = "gen")]
    pub(super) impl_plan: ImplPlan,
    #[darling(default)]
    pub(super) preferred: Option<RawIdentifier>,
    #[darling(default)]
    pub(super) batch_chunk_size_limit: Option<usize>,

    pub(super) data: ast::Data<util::Ignored, ModelFieldArgs>,
}

#[derive(Debug, PartialEq, Eq, FromMeta)]
pub(super) struct ImplPlan {
    #[darling(default)]
    pub(super) ops: Crud,
    #[darling(default)]
    pub(super) batch_ops: Crud,
    #[darling(default)]
    pub(super) list: bool,
}

#[derive(Debug, PartialEq)]
#[allow(clippy::large_enum_variant)] // yeah sure, but that's by design though...
pub(super) enum ErrorArgs {
    Single(syn::Path),
    Rw(RwErrorArgs),
    Detailed(DetailedErrorArgs),
}

impl darling::FromMeta for ErrorArgs {
    fn from_expr(expr: &syn::Expr) -> darling::Result<Self> {
        let syn::Expr::Path(path) = expr else {
            return Err(darling::Error::custom("expected a type").with_span(expr));
        };
        Ok(Self::Single(path.path.clone()))
    }

    fn from_list(items: &[ast::NestedMeta]) -> darling::Result<Self> {
        match (
            RwErrorArgs::from_list(items),
            DetailedErrorArgs::from_list(items),
        ) {
            (Ok(rw), Err(_)) => Ok(ErrorArgs::Rw(rw)),
            (Err(_), Ok(detail)) => Ok(ErrorArgs::Detailed(detail)),
            (Ok(_), Ok(_)) => unreachable!(
                "both branch cannot be parsed successfully at the same time since properties of each are disjoint sets"
            ),
            (Err(e), Err(f)) => Err(darling::Error::custom(format!(
                "Model: error: expected either read/write xor create/retrieve/update/delete errors: {e}, {f}"
            ))),
        }
    }
}

#[derive(FromMeta, Debug, PartialEq)]
pub(super) struct RwErrorArgs {
    /// retrieve and list
    pub(super) read: Option<syn::Path>,
    /// create, update and delete
    pub(super) write: Option<syn::Path>,
}

#[derive(FromMeta, Debug, PartialEq)]
pub(super) struct DetailedErrorArgs {
    pub(super) create: Option<syn::Path>,
    pub(super) retrieve: Option<syn::Path>,
    pub(super) update: Option<syn::Path>,
    pub(super) delete: Option<syn::Path>,
    pub(super) list: Option<syn::Path>,
}

#[derive(FromMeta, Default, Debug, PartialEq)]
pub(super) struct GeneratedTypeArgs {
    #[darling(default)]
    pub(super) type_name: Option<syn::Ident>,
    #[darling(default)]
    pub(super) derive: PathList,
    #[darling(default)]
    pub(super) public: bool,
}

#[derive(FromField, Debug)]
#[darling(attributes(model), forward_attrs(allow, doc, cfg))]
pub(super) struct ModelFieldArgs {
    pub(super) ident: Option<syn::Ident>,
    pub(super) ty: syn::Type,
    #[darling(default)]
    pub(super) builder_fn: Option<syn::Ident>,
    #[darling(default)]
    pub(super) column: Option<syn::Path>,
    #[darling(default)]
    pub(super) builder_skip: bool,
    #[darling(default)]
    pub(super) identifier: bool,
    #[darling(default)]
    pub(super) preferred: bool,
    #[darling(default)]
    pub(super) primary: bool,
    #[darling(default)]
    pub(super) json: bool,
    #[darling(default)]
    pub(super) geo: bool,
    #[darling(default)]
    pub(super) to_string: bool,
    #[darling(default)]
    pub(super) to_enum: bool,
    #[darling(default)]
    pub(super) remote: Option<syn::Type>,
    #[darling(default)]
    pub(super) uom_unit: Option<syn::Path>,
}
