use super::np;
use quote::ToTokens;
use quote::quote;

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
    pub(super) flatten: bool,
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
        let np!(field_column, field_vis, field_name, field_type, field_embed): np!(vec5) = fields
            .iter()
            .map(|field| {
                let RowFieldDecl {
                    vis,
                    name,
                    ty,
                    column_name,
                    flatten,
                } = field;
                let embed = if *flatten {
                    quote! {embed}
                } else {
                    quote! {}
                };
                np!(column_name, vis, name, ty, embed)
            })
            .unzip();
        tokens.extend(quote! {
            #[derive(diesel::Queryable, #(#additional_derives),*)]
            #[diesel(table_name = #table)]
            #vis struct #ident {
                #(#[diesel(column_name = #field_column, #field_embed)] #field_vis #field_name: #field_type),*
            }
        });
    }
}
