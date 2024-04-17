mod changeset_decl;
mod identifiable_impl;
mod model_from_row_impl;
mod model_impl;
mod preferred_id_impl;
mod row_decl;

use proc_macro2::{Span, TokenStream};
use quote::quote;

use crate::modelv2::codegen::changeset_decl::ChangesetDecl;
use crate::modelv2::codegen::changeset_decl::ChangesetFieldDecl;
use crate::modelv2::codegen::model_impl::ModelImpl;
use crate::modelv2::codegen::row_decl::RowDecl;
use crate::modelv2::codegen::row_decl::RowFieldDecl;

use self::identifiable_impl::IdentifiableImpl;
use self::model_from_row_impl::ModelFromRowImpl;
use self::preferred_id_impl::PreferredIdImpl;

use super::utils::np;
use super::Identifier;
use super::ModelConfig;

impl ModelConfig {
    pub(crate) fn model_impl(&self) -> ModelImpl {
        ModelImpl {
            model: self.model.clone(),
            row: self.row.ident(),
            changeset: self.changeset.ident(),
        }
    }

    pub(crate) fn row_decl(&self) -> RowDecl {
        RowDecl {
            vis: self.visibility.clone(),
            ident: self.row.ident(),
            table: self.table.clone(),
            additional_derives: self.row.derive.clone(),
            fields: self
                .iter_fields()
                .map(|field| RowFieldDecl {
                    vis: self.row.visibility(),
                    name: field.ident.clone(),
                    ty: field.transform_type(),
                    column: field.column.clone(),
                })
                .collect(),
        }
    }

    pub(crate) fn changeset_decl(&self) -> ChangesetDecl {
        ChangesetDecl {
            vis: self.visibility.clone(),
            ident: self.changeset.ident(),
            table: self.table.clone(),
            additional_derives: self.changeset.derive.clone(),
            fields: self
                .iter_fields()
                .filter(|f| !self.is_primary(f))
                .map(|field| ChangesetFieldDecl {
                    vis: self.changeset.visibility(),
                    name: field.ident.clone(),
                    ty: field.transform_type(),
                    column: field.column.clone(),
                })
                .collect(),
        }
    }

    pub fn make_builder(&self, changeset: bool) -> TokenStream {
        let np!(fields, fns, flat_fns, types, bodies, flat_bodies): np!(vec6) = self
            .iter_fields()
            .filter(|f| !self.is_primary(f))
            .filter(|field| !field.builder_skip)
            .map(|field| {
                let ident = &field.ident;
                let expr = field.into_transformed(quote! { #ident });
                let body = if changeset {
                    quote! { self.#ident = Some(#expr) }
                } else {
                    quote! { self.changeset.#ident = Some(#expr) }
                };
                let flat_body = if changeset {
                    quote! { self.#ident = #ident.map(|#ident| #expr) }
                } else {
                    quote! { self.changeset.#ident = #ident.map(|#ident| #expr) }
                };
                np!(
                    ident,
                    &field.builder_ident,
                    syn::Ident::new(&format!("flat_{}", &field.builder_ident), Span::call_site()),
                    &field.ty,
                    body,
                    flat_body
                )
            })
            .unzip();

        let impl_decl = if changeset {
            let tn = self.changeset.ident();
            quote! { impl #tn }
        } else {
            let tn = &self.model;
            quote! { impl<'a> crate::modelsv2::Patch<'a, #tn> }
        };

        quote! {
            #[automatically_derived]
            #impl_decl {
                #(
                    #[allow(unused)]
                    #[must_use = "builder methods are intended to be chained"]
                    pub fn #fns(mut self, #fields: #types) -> Self {
                        #bodies;
                        self
                    }

                    #[allow(unused)]
                    #[must_use = "builder methods are intended to be chained"]
                    pub fn #flat_fns(mut self, #fields: Option<#types>) -> Self {
                        #flat_bodies;
                        self
                    }
                )*
            }
        }
    }

    pub(crate) fn identifiable_impls(&self) -> Vec<IdentifiableImpl> {
        self.identifiers
            .iter()
            .map(|identifier| IdentifiableImpl {
                model: self.model.clone(),
                ty: identifier.type_expr(self),
                fields: identifier.get_idents(),
            })
            .collect()
    }

    pub(crate) fn preferred_id_impl(&self) -> PreferredIdImpl {
        PreferredIdImpl {
            model: self.model.clone(),
            ty: self.preferred_identifier.type_expr(self),
        }
    }

    pub(crate) fn model_from_row_impl(&self) -> ModelFromRowImpl {
        ModelFromRowImpl {
            model: self.model.clone(),
            row: self.row.ident(),
            fields: self.fields.clone(),
        }
    }

    pub fn make_from_impls(&self) -> TokenStream {
        let model = &self.model;
        let (cs_field, cs_value): (Vec<_>, Vec<_>) = self
            .iter_fields()
            .filter(|f| !self.is_primary(f))
            .map(|field| {
                let ident = &field.ident;
                (ident, field.into_transformed(quote! { model.#ident }))
            })
            .unzip();
        let cs_ident = self.changeset.ident();
        quote! {
            #[automatically_derived]
            impl From<#model> for #cs_ident {
                fn from(model: #model) -> Self {
                    Self {
                        #( #cs_field: Some(#cs_value) ),*
                    }
                }
            }
        }
    }

    pub fn make_model_traits_impl(&self) -> TokenStream {
        let model = &self.model;
        let table_mod = &self.table;
        let table_name = self.table_name();
        let row_ident = self.row.ident();
        let cs_ident = self.changeset.ident();
        let field_count = self.fields.len();
        let (pk_ident, pk_column) = match &self.primary_field {
            Identifier::Field(ident) => (
                ident,
                syn::Ident::new(&self.fields.get(ident).unwrap().column, Span::call_site()),
            ),
            Identifier::Compound(_) => {
                unreachable!("primary annotation is always put on a single field")
            }
        };

        let np!(ty, ident, filter, batch_filter, batch_param_count): np!(vec5) = self
            .identifiers
            .iter()
            .map(|id| {
                let type_expr = id.type_expr(self);
                let lvalue = id.get_ident_lvalue();

                let (ident, column): (Vec<_>, Vec<_>) = id
                    .get_idents()
                    .into_iter()
                    .map(|ident| {
                        let field = self.fields.get(&ident).unwrap();
                        let column = syn::Ident::new(&field.column, Span::call_site());
                        (ident, column)
                    })
                    .unzip();

                // Single row access
                let filters = quote! { #(filter(dsl::#column.eq(#ident))).* };

                // Batched row access (batch_filter is the argument of a .or_filter())
                let batch_filter = {
                    let mut idents = ident.iter().zip(column.iter()).rev();
                    let (first_ident, first_column) = idents.next().unwrap();
                    idents.fold(
                        quote! { dsl::#first_column.eq(#first_ident) },
                        |acc, (ident, column)| {
                            quote! { dsl::#column.eq(#ident).and(#acc) }
                        },
                    )
                };
                let param_count = ident.len();

                np!(type_expr, lvalue, filters, batch_filter, param_count)
            })
            .unzip();

        quote! {
            #(
                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::Retrieve<#ty> for #model {
                    async fn retrieve(
                        conn: &mut diesel_async::AsyncPgConnection,
                        #ident: #ty,
                    ) -> crate::error::Result<Option<#model>> {
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use #table_mod::dsl;
                        dsl::#table_name
                            .#filter
                            .first::<#row_ident>(conn)
                            .await
                            .map(Into::into)
                            .optional()
                            .map_err(Into::into)
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::Update<#ty, #model> for #cs_ident {
                    async fn update(
                        self,
                        conn: &mut diesel_async::AsyncPgConnection,
                        #ident: #ty,
                    ) -> crate::error::Result<Option<#model>> {
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use #table_mod::dsl;
                        diesel::update(dsl::#table_name.#filter)
                            .set(&self)
                            .get_result::<#row_ident>(conn)
                            .await
                            .map(Into::into)
                            .optional()
                            .map_err(Into::into)
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::DeleteStatic<#ty> for #model {
                    async fn delete_static(
                        conn: &mut diesel_async::AsyncPgConnection,
                        #ident: #ty,
                    ) -> crate::error::Result<bool> {
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use #table_mod::dsl;
                        diesel::delete(dsl::#table_name.#filter)
                            .execute(conn)
                            .await
                            .map(|n| n == 1)
                            .map_err(Into::into)
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::Exists<#ty> for #model {
                    async fn exists(
                        conn: &mut diesel_async::AsyncPgConnection,
                        #ident: #ty,
                    ) -> crate::error::Result<bool> {
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use #table_mod::dsl;
                        diesel::select(diesel::dsl::exists(dsl::#table_name.#filter))
                            .get_result(conn)
                            .await
                            .map_err(Into::into)
                    }
                }
            )*

            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Create<#model> for #cs_ident {
                async fn create(
                    self,
                    conn: &mut diesel_async::AsyncPgConnection,
                ) -> crate::error::Result<#model> {
                    use diesel_async::RunQueryDsl;
                    diesel::insert_into(#table_mod::table)
                        .values(&self)
                        .get_result::<#row_ident>(conn)
                        .await
                        .map(Into::into)
                        .map_err(Into::into)
                }
            }

            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::Delete for #model {
                async fn delete(
                    &self,
                    conn: &mut diesel_async::AsyncPgConnection,
                ) -> crate::error::Result<bool> {
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use #table_mod::dsl;
                    let id = self.#pk_ident;
                    diesel::delete(#table_mod::table.find(id))
                        .execute(conn)
                        .await
                        .map(|n| n == 1)
                        .map_err(Into::into)
                }
            }

            #[automatically_derived]
            #[async_trait::async_trait]
            impl crate::modelsv2::CreateBatch<#cs_ident> for #model {
                async fn create_batch<
                    I: std::iter::IntoIterator<Item = #cs_ident> + Send + 'async_trait,
                    C: Default + std::iter::Extend<Self> + Send,
                >(
                    conn: &mut diesel_async::AsyncPgConnection,
                    values: I,
                ) -> crate::error::Result<C> {
                    use crate::modelsv2::Model;
                    use #table_mod::dsl;
                    use diesel::prelude::*;
                    use diesel_async::RunQueryDsl;
                    use futures_util::stream::TryStreamExt;
                    Ok(crate::chunked_for_libpq! {
                        #field_count,
                        values,
                        C::default(),
                        chunk => {
                            diesel::insert_into(dsl::#table_name)
                                .values(chunk)
                                .load_stream::<#row_ident>(conn)
                                .await
                                .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                .await?
                        }
                    })
                }
            }

            #(
                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::CreateBatchWithKey<#cs_ident, #ty> for #model {
                    async fn create_batch_with_key<
                        I: std::iter::IntoIterator<Item = #cs_ident> + Send + 'async_trait,
                        C: Default + std::iter::Extend<(#ty, Self)> + Send,
                    >(
                        conn: &mut diesel_async::AsyncPgConnection,
                        values: I,
                    ) -> crate::error::Result<C> {
                        use crate::models::Identifiable;
                        use crate::modelsv2::Model;
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use futures_util::stream::TryStreamExt;
                        Ok(crate::chunked_for_libpq! {
                            #field_count,
                            values,
                            C::default(),
                            chunk => {
                                diesel::insert_into(dsl::#table_name)
                                    .values(chunk)
                                    .load_stream::<#row_ident>(conn)
                                    .await
                                    .map(|s| {
                                        s.map_ok(|row| {
                                            let model = <#model as Model>::from_row(row);
                                            (model.get_id(), model)
                                        })
                                        .try_collect::<Vec<_>>()
                                    })?
                                    .await?
                            }
                        })
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::RetrieveBatchUnchecked<#ty> for #model {
                    async fn retrieve_batch_unchecked<
                        I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                        C: Default + std::iter::Extend<#model> + Send,
                    >(
                        conn: &mut diesel_async::AsyncPgConnection,
                        ids: I,
                    ) -> crate::error::Result<C> {
                        use crate::modelsv2::Model;
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use futures_util::stream::TryStreamExt;
                        Ok(crate::chunked_for_libpq! {
                            #batch_param_count,
                            ids,
                            C::default(),
                            chunk => {
                                // Diesel doesn't allow `(col1, col2).eq_any(iterator<(&T, &U)>)` because it imposes restrictions
                                // on tuple usage. Doing it this way is the suggested workaround (https://github.com/diesel-rs/diesel/issues/3222#issuecomment-1177433434).
                                // eq_any reallocates its argument anyway so the additional cost with this method are the boxing and the diesel wrappers.
                                let mut query = dsl::#table_name.into_boxed();
                                for #ident in chunk.into_iter() {
                                    query = query.or_filter(#batch_filter);
                                }
                                query
                                    .load_stream::<#row_ident>(conn)
                                    .await
                                    .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                    .await?
                            }
                        })
                    }

                    async fn retrieve_batch_with_key_unchecked<
                        I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                        C: Default + std::iter::Extend<(#ty, #model)> + Send,
                    >(
                        conn: &mut diesel_async::AsyncPgConnection,
                        ids: I,
                    ) -> crate::error::Result<C> {
                        use crate::models::Identifiable;
                        use crate::modelsv2::Model;
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use futures_util::stream::TryStreamExt;
                        Ok(crate::chunked_for_libpq! {
                            #batch_param_count,
                            ids,
                            C::default(),
                            chunk => {
                                let mut query = dsl::#table_name.into_boxed();
                                for #ident in chunk.into_iter() {
                                    query = query.or_filter(#batch_filter);
                                }
                                query
                                    .load_stream::<#row_ident>(conn)
                                    .await
                                    .map(|s| {
                                        s.map_ok(|row| {
                                            let model = <#model as Model>::from_row(row);
                                            (model.get_id(), model)
                                        })
                                        .try_collect::<Vec<_>>()
                                    })?
                                    .await?
                            }
                        })
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::UpdateBatchUnchecked<#model, #ty> for #cs_ident {
                    async fn update_batch_unchecked<
                        I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                        C: Default + std::iter::Extend<#model> + Send,
                    >(
                        self,
                        conn: &mut diesel_async::AsyncPgConnection,
                        ids: I,
                    ) -> crate::error::Result<C> {
                        use crate::modelsv2::Model;
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use futures_util::stream::TryStreamExt;
                        Ok(crate::chunked_for_libpq! {
                            #batch_param_count,
                            ids,
                            C::default(),
                            chunk => {
                                // We have to do it this way because we can't .or_filter() on a boxed update statement
                                let mut query = dsl::#table_name.select(dsl::#pk_column).into_boxed();
                                for #ident in chunk.into_iter() {
                                    query = query.or_filter(#batch_filter);
                                }
                                diesel::update(dsl::#table_name)
                                    .filter(dsl::#pk_column.eq_any(query))
                                    .set(&self)
                                    .load_stream::<#row_ident>(conn)
                                    .await
                                    .map(|s| s.map_ok(<#model as Model>::from_row).try_collect::<Vec<_>>())?
                                    .await?
                            }
                        })
                    }

                    async fn update_batch_with_key_unchecked<
                        I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait,
                        C: Default + std::iter::Extend<(#ty, #model)> + Send,
                    >(
                        self,
                        conn: &mut diesel_async::AsyncPgConnection,
                        ids: I,
                    ) -> crate::error::Result<C> {
                        use crate::models::Identifiable;
                        use crate::modelsv2::Model;
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        use futures_util::stream::TryStreamExt;
                        Ok(crate::chunked_for_libpq! {
                            #batch_param_count,
                            ids,
                            C::default(),
                            chunk => {
                                let mut query = dsl::#table_name.select(dsl::#pk_column).into_boxed();
                                for #ident in chunk.into_iter() {
                                    query = query.or_filter(#batch_filter);
                                }
                                diesel::update(dsl::#table_name)
                                    .filter(dsl::#pk_column.eq_any(query))
                                    .set(&self)
                                    .load_stream::<#row_ident>(conn)
                                    .await
                                    .map(|s| {
                                        s.map_ok(|row| {
                                            let model = <#model as Model>::from_row(row);
                                            (model.get_id(), model)
                                        })
                                        .try_collect::<Vec<_>>()
                                    })?
                                    .await?
                            }
                        })
                    }
                }

                #[automatically_derived]
                #[async_trait::async_trait]
                impl crate::modelsv2::DeleteBatch<#ty> for #model {
                    async fn delete_batch<I: std::iter::IntoIterator<Item = #ty> + Send + 'async_trait>(
                        conn: &mut diesel_async::AsyncPgConnection,
                        ids: I,
                    ) -> crate::error::Result<usize> {
                        use #table_mod::dsl;
                        use diesel::prelude::*;
                        use diesel_async::RunQueryDsl;
                        let counts = crate::chunked_for_libpq! {
                            #batch_param_count,
                            ids,
                            chunk => {
                                let mut query = diesel::delete(dsl::#table_name).into_boxed();
                                for #ident in chunk.into_iter() {
                                    query = query.or_filter(#batch_filter);
                                }
                                query.execute(conn).await?
                            }
                        };
                        Ok(counts.into_iter().sum())
                    }
                }
            )*
        }
    }
}
