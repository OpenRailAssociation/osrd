use super::np;
use quote::quote;
use quote::ToTokens;

pub(crate) struct RowDecl {
    pub(super) vis: syn::Visibility,
    pub(super) ident: syn::Ident,
    pub(super) table: syn::Path,
    pub(super) additional_derives: darling::util::PathList,
    pub(super) fields: Vec<RowFieldDecl>,
}

pub(crate) struct RowFieldDecl {
    pub(super) vis: syn::Visibility,
    pub(super) name: syn::Ident,
    pub(super) ty: syn::Type,
    pub(super) column_name: String,
}

impl ToTokens for RowDecl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            vis,
            ident,
            table,
            additional_derives,
            fields,
        } = self;
        let np!(field_column, field_vis, field_name, field_type): np!(vec4) = fields
            .iter()
            .map(|field| {
                let RowFieldDecl {
                    vis,
                    name,
                    ty,
                    column_name,
                } = field;
                np!(column_name, vis, name, ty)
            })
            .unzip();
        tokens.extend(quote! {
            #[derive(Queryable, QueryableByName, #(#additional_derives),*)]
            #[diesel(table_name = #table)]
            #vis struct #ident {
                #(#[diesel(column_name = #field_column)] #field_vis #field_name: #field_type),*
            }
        });
    }
}
