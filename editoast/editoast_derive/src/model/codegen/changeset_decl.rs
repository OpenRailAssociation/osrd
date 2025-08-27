use super::np;
use quote::ToTokens;
use quote::quote;

pub(crate) struct ChangesetDecl {
    pub(super) vis: syn::Visibility,
    pub(super) ident: syn::Ident,
    pub(super) table: syn::Path,
    pub(super) additional_derives: darling::util::PathList,
    pub(super) fields: Vec<ChangesetFieldDecl>,
}

pub(crate) struct ChangesetFieldDecl {
    pub(super) vis: syn::Visibility,
    pub(super) name: syn::Ident,
    pub(super) ty: syn::Type,
    pub(super) column_name: String,
}

impl ToTokens for ChangesetDecl {
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
                let ChangesetFieldDecl {
                    vis,
                    name,
                    ty,
                    column_name,
                } = field;
                np!(column_name, vis, name, ty)
            })
            .unzip();

        // If the struct has no fields, Queryable, AsChangeset and Insertable cannot be derived.
        if fields.is_empty() {
            tokens.extend(quote! {
                #[derive(Debug, Default, #(#additional_derives),*)]
                #vis struct #ident;
            });
        } else {
            tokens.extend(quote! {
                #[derive(Debug, Default, diesel::Queryable, diesel::AsChangeset, diesel::Insertable, #(#additional_derives),*)]
                #[diesel(table_name = #table)]
                #vis struct #ident {
                    #(
                        #[diesel(deserialize_as = #field_type, column_name = #field_column)]
                        #field_vis #field_name: Option<#field_type>
                    ),*
                }
            });
        }
    }
}
