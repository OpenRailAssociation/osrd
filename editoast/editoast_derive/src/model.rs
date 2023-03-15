use darling::{FromDeriveInput, Result};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{DeriveInput, Ident};

#[derive(FromDeriveInput)]
#[darling(attributes(model), forward_attrs(allow, doc, cfg))]
struct ModelOptions {
    /// Table of the model
    table: syn::Path,
    /// Enable the `create` functions
    create: Option<bool>,
    /// Enable the `load` functions
    retrieve: Option<bool>,
    /// Enable the `delete` functions
    delete: Option<bool>,
}

struct Config {
    model_name: Ident,
    table: syn::Path,
    create_enabled: bool,
    retrieve_enabled: bool,
    delete_enabled: bool,
}

impl Config {
    pub fn new(model_name: Ident, options: &ModelOptions) -> Self {
        Self {
            model_name,
            table: options.table.clone(),
            create_enabled: options.create.unwrap_or(false),
            retrieve_enabled: options.retrieve.unwrap_or(false),
            delete_enabled: options.delete.unwrap_or(false),
        }
    }
}

pub fn model(input: &mut DeriveInput) -> Result<TokenStream> {
    let options = ModelOptions::from_derive_input(&input).expect("Model: bad options");
    let model_name = &input.ident;
    let config = Config::new(model_name.clone(), &options);

    let create_functions = create_functions(&config);
    let retrieve_functions = retrieve_functions(&config);
    let delete_functions = delete_functions(&config);

    let expanded = quote! {
        #create_functions
        #delete_functions
        #retrieve_functions
    };
    Ok(expanded)
}

fn create_functions(config: &Config) -> TokenStream {
    // If `create` is not enabled, we don't generate anything
    if !config.create_enabled {
        return quote! {};
    }
    let table = &config.table;
    let model_name = &config.model_name;
    let documentation = format!(
        r#"
        Create a new `{model_name}` in the database.
        Returns the created object with its default values filled (like the id).

        ### Example

        ```
        let obj = {model_name} {{ id: None, ... }};
        let created_obj = obj.create(db_pool).await?;
        let obj_id = created_obj.id.unwrap();
        ```
        "#
    );

    quote! {
        #[async_trait::async_trait]
        impl crate::models::Create for #model_name {
            fn create_conn(self, conn: &mut diesel::PgConnection) -> crate::error::Result<Self> {
                use #table::table;
                use diesel::RunQueryDsl;

                Ok(diesel::insert_into(table).values(&self).get_result(conn)?)
            }

            #[doc = #documentation]
            async fn create(self, db_pool: actix_web::web::Data<crate::DbPool>) -> crate::error::Result<Self> {
                use actix_web::web::block;

                block::<_, crate::error::Result<_>>(move || {
                    let mut conn = db_pool.get()?;
                    self.create_conn(&mut conn)
                })
                .await
                .unwrap()
            }
        }
    }
}

fn retrieve_functions(config: &Config) -> TokenStream {
    // If `retrieve` is not enabled, we don't generate anything
    if !config.retrieve_enabled {
        return quote! {};
    }
    let table = &config.table;

    let model_name = &config.model_name;
    let retrieve_documentation = format!(
        r#"
        Retrieve an option of `{model_name}` given its ID (primary key).
        Returns None if not found.

        ### Example

        ```
        if let Some(obj) = {model_name}::retrieve(db_pool, 42).await? {{
            // do something with obj
        }}
        ```
        "#
    );

    quote! {
        #[async_trait::async_trait]
        impl crate::models::Retrieve for #model_name {
            fn retrieve_conn(conn: &mut diesel::PgConnection, obj_id: i64) -> crate::error::Result<Option<Self>> {
                use #table::table;
                use #table::dsl;
                use diesel::RunQueryDsl;

                match table
                    .filter(dsl::id.eq(obj_id))
                    .get_result(conn)
                {
                    Ok(doc) => Ok(Some(doc)),
                    Err(DieselError::NotFound) => Ok(None),
                    Err(e) => Err(e.into()),
                }
            }

            #[doc = #retrieve_documentation]
            async fn retrieve(db_pool: actix_web::web::Data<crate::DbPool>, id: i64) -> crate::error::Result<Option<Self>> {
                use actix_web::web::block;

                block::<_, crate::error::Result<_>>(move || {
                    let mut conn = db_pool.get()?;
                    Self::retrieve_conn(&mut conn, id)
                })
                .await
                .unwrap()
            }
        }
    }
}

fn delete_functions(config: &Config) -> TokenStream {
    // If `delete` is not enabled, we don't generate anything
    if !config.delete_enabled {
        return quote! {};
    }
    let table = &config.table;

    let model_name = &config.model_name;
    let documentation = format!(
        r#"
        Delete a `{model_name}` given its ID (primary key).
        Return `false` if not found.

        ### Example

        ```
        assert!({model_name}::delete(db_pool, 42).await?);
        ```
        "#
    );

    quote! {
        #[async_trait::async_trait]
        impl crate::models::Delete for #model_name {
            fn delete_conn(conn: &mut diesel::PgConnection, obj_id: i64) -> crate::error::Result<bool> {
                use #table::table;
                use #table::dsl;
                use diesel::RunQueryDsl;

                match diesel::delete(table.filter(dsl::id.eq(obj_id))).execute(conn)
                {
                    Ok(1) => Ok(true),
                    Ok(_) => Ok(false),
                    Err(e) => Err(e.into()),
                }
            }

            #[doc = #documentation]
            async fn delete(db_pool: actix_web::web::Data<crate::DbPool>, id: i64) -> crate::error::Result<bool> {
                use actix_web::web::block;

                block::<_, crate::error::Result<_>>(move || {
                    let mut conn = db_pool.get()?;
                    Self::delete_conn(&mut conn, id)
                })
                .await
                .unwrap()
            }
        }
    }
}
