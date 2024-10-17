pub mod form;
pub mod light;

pub use form::RollingStockForm;

use std::io::Cursor;

use axum::extract::Json;
use axum::extract::Multipart;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::rolling_stock::RollingStockLivery;
use image::DynamicImage;
use image::GenericImage;
use image::ImageBuffer;
use image::ImageFormat;
use image::ImageReader;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;
use validator::Validate;

use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::rolling_stock_livery::RollingStockLiveryModel;
use crate::models::rolling_stock_model::ScenarioReference;
use crate::models::Document;
use crate::models::RollingStockModel;
use crate::models::RollingStockSeparatedImageModel;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;

crate::routes! {
    "/rolling_stock" => {
        create,
        "/power_restrictions" => get_power_restrictions,
        "/name/{rolling_stock_name}" => get_by_name,
        "/{rolling_stock_id}" => {
            get,
            update,
            delete,
            "/locked" => update_locked,
            "/livery" => create_livery,
            "/usage" => get_usage,
        },
    },
    &light,
}

editoast_common::schemas! {
    RollingStockForm,
    DeleteRollingStockQueryParams,
    RollingStockLockedUpdateForm,
    RollingStockLiveryCreateForm,
    RollingStockError,
    RollingStockKey,
    RollingStockWithLiveries,
    ScenarioReference,
    light::schemas(),
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    #[schema(value_type = RollingStock)]
    pub rolling_stock: RollingStockModel,
    pub liveries: Vec<RollingStockLivery>,
}

impl RollingStockWithLiveries {
    async fn try_fetch(conn: &mut DbConnection, rolling_stock: RollingStockModel) -> Result<Self> {
        let rolling_stock_id = rolling_stock.id;
        let liveries = RollingStockLiveryModel::list(
            conn,
            SelectionSettings::new()
                .filter(move || RollingStockLiveryModel::ROLLING_STOCK_ID.eq(rolling_stock_id)),
        )
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
        Ok(Self {
            rolling_stock,
            liveries,
        })
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Display, ToSchema)]
#[serde(tag = "type", content = "key")]
pub enum RollingStockKey {
    Id(i64),
    Name(String),
}

#[derive(Debug, Error, EditoastError, ToSchema, Serialize)] // serde is required in order to skip variants
#[editoast_error(base_id = "rollingstocks")]
pub enum RollingStockError {
    #[error("Impossible to read the separated image")]
    #[editoast_error(status = 500)]
    CannotReadImage,

    #[error("Impossible to copy the separated image on the compound image")]
    #[editoast_error(status = 500)]
    CannotCreateCompoundImage,

    #[error("Invalid livery import payload: {0}")]
    #[editoast_error(status = 400, no_context)]
    #[serde(skip)]
    LiveryMultipartError(#[from] LiveryMultipartError),

    #[error("Rolling stock '{rolling_stock_key}' could not be found")]
    #[editoast_error(status = 404)]
    KeyNotFound { rolling_stock_key: RollingStockKey },

    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },

    #[error("Rolling stock '{rolling_stock_id}' is locked")]
    #[editoast_error(status = 409)]
    IsLocked { rolling_stock_id: i64 },

    #[error("Rolling stock '{rolling_stock_id}' is used")]
    #[editoast_error(status = 409)]
    IsUsed {
        rolling_stock_id: i64,
        usage: Vec<ScenarioReference>,
    },

    #[error("Base power class is an empty string")]
    #[editoast_error(status = 400)]
    BasePowerClassEmpty,
}

#[derive(Debug, Error)]
pub(crate) enum LiveryMultipartError {
    #[error("Invalid multipart content")]
    MultipartError(#[from] axum::extract::multipart::MultipartError),

    #[error("Missing multipart field name, cannot process request")]
    MissingFieldName,

    #[error("Unrecognized multipart field '{field_name}'")]
    UnrecognizedField { field_name: String },

    #[error("Missing multipart field 'name'")]
    MissingLiveryName,

    #[error("Could not read multipart field 'name' as text: {source}")]
    InvalidName {
        source: axum::extract::multipart::MultipartError,
    },

    #[error("Missing one or more multipart fields 'images'")]
    MissingLiveryContent,

    #[error("Invalid bytes in multipart field 'images': {source}")]
    InvalidLiveryContent {
        source: axum::extract::multipart::MultipartError,
    },
}

pub fn map_diesel_error(e: InternalError, name: impl AsRef<str>) -> InternalError {
    if e.message
        .contains(r#"duplicate key value violates unique constraint "rolling_stock_name_key""#)
    {
        RollingStockError::NameAlreadyUsed { name: name.as_ref().to_string() }.into()
    } else if e.message.contains(r#"new row for relation "rolling_stock" violates check constraint "base_power_class_null_or_non_empty""#) {
        RollingStockError::BasePowerClassEmpty.into()
    } else {
        e
    }
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct RollingStockIdParam {
    rolling_stock_id: i64,
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct RollingStockNameParam {
    rolling_stock_name: String,
}

/// Get a rolling stock by Id
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_id): Path<i64>,
) -> Result<Json<RollingStockWithLiveries>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let rolling_stock = retrieve_existing_rolling_stock(
        &mut db_pool.get().await?,
        RollingStockKey::Id(rolling_stock_id),
    )
    .await?;
    let rolling_stock_with_liveries =
        RollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(rolling_stock_with_liveries))
}

/// Get a rolling stock by name
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
async fn get_by_name(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_name): Path<String>,
) -> Result<Json<RollingStockWithLiveries>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let rolling_stock = retrieve_existing_rolling_stock(
        &mut db_pool.get().await?,
        RollingStockKey::Name(rolling_stock_name),
    )
    .await?;
    let rolling_stock_with_liveries =
        RollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(rolling_stock_with_liveries))
}

/// Returns the set of power restrictions for all rolling_stocks modes.
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    responses(
        (status = 200, description = "Retrieve the power restrictions list", body = Vec<String>)
    )
)]
async fn get_power_restrictions(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
) -> Result<Json<Vec<String>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let conn = &mut db_pool.get().await?;
    let power_restrictions = RollingStockModel::get_power_restrictions(conn).await?;
    Ok(Json(
        power_restrictions
            .into_iter()
            .map(|pr| (pr.power_restriction))
            .collect(),
    ))
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
struct PostRollingStockQueryParams {
    #[serde(default)]
    locked: bool,
}

/// Create a rolling stock
#[utoipa::path(
    post, path = "",
    tag = "rolling_stock",
    params(PostRollingStockQueryParams),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStock)
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Query(query_params): Query<PostRollingStockQueryParams>,
    Json(rolling_stock_form): Json<RollingStockForm>,
) -> Result<Json<RollingStockModel>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    rolling_stock_form.validate()?;
    let conn = &mut db_pool.get().await?;
    let rolling_stock_name = rolling_stock_form.name.clone();
    let rolling_stock_changeset: Changeset<RollingStockModel> = rolling_stock_form.into();

    let rolling_stock = rolling_stock_changeset
        .locked(query_params.locked)
        .version(0)
        .create(conn)
        .await
        .map_err(|e| map_diesel_error(e, rolling_stock_name))?;

    Ok(Json(rolling_stock))
}

/// Patch a rolling stock
#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockWithLiveries)
    )
)]
async fn update(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_id): Path<i64>,
    Json(rolling_stock_form): Json<RollingStockForm>,
) -> Result<Json<RollingStockWithLiveries>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    rolling_stock_form.validate()?;
    let name = rolling_stock_form.name.clone();

    let new_rolling_stock = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let previous_rolling_stock = RollingStockModel::retrieve_or_fail(
                    &mut conn.clone(),
                    rolling_stock_id,
                    || RollingStockError::KeyNotFound {
                        rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
                    },
                )
                .await?;
                assert_rolling_stock_unlocked(&previous_rolling_stock)?;

                let mut new_rolling_stock =
                    Into::<Changeset<RollingStockModel>>::into(rolling_stock_form)
                        .update(&mut conn.clone(), rolling_stock_id)
                        .await
                        .map_err(|e| map_diesel_error(e, name.clone()))?
                        .ok_or(RollingStockError::KeyNotFound {
                            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
                        })?;

                if new_rolling_stock != previous_rolling_stock {
                    new_rolling_stock.version += 1;
                    new_rolling_stock
                        .save(&mut conn.clone())
                        .await
                        .map_err(|err| map_diesel_error(err, name))?;
                }
                Ok(new_rolling_stock)
            }
            .scope_boxed()
        })
        .await?;

    let new_rolling_stock_with_liveries =
        RollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, new_rolling_stock).await?;

    Ok(Json(new_rolling_stock_with_liveries))
}

#[derive(Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
struct DeleteRollingStockQueryParams {
    /// force the deletion even if it's used
    #[serde(default)]
    force: bool,
}

/// Delete a rolling_stock and all entities linked to it
#[utoipa::path(
    delete, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam, DeleteRollingStockQueryParams),
    responses(
        (status = 204, description = "The rolling stock was deleted successfully"),
        (status = 404, description = "The requested rolling stock is locked"),
        (status = 404, description = "The requested rolling stock was not found"),
        (status = 409, description = "The requested rolling stock is used", body = RollingStockError),
    )
)]
async fn delete(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_id): Path<i64>,
    Query(DeleteRollingStockQueryParams { force }): Query<DeleteRollingStockQueryParams>,
) -> Result<impl IntoResponse> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let conn = &mut db_pool.get().await?;

    let rolling_stock = RollingStockModel::retrieve_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    assert_rolling_stock_unlocked(&rolling_stock)?;

    if force {
        delete_rolling_stock(conn, rolling_stock_id).await?;
        return Ok(StatusCode::NO_CONTENT);
    }

    let scenarios_using_rs = rolling_stock.get_usage(conn).await?;
    if scenarios_using_rs.is_empty() {
        delete_rolling_stock(conn, rolling_stock_id).await?;
        return Ok(StatusCode::NO_CONTENT);
    }
    Err(RollingStockError::IsUsed {
        rolling_stock_id,
        usage: scenarios_using_rs,
    }
    .into())
}

async fn delete_rolling_stock(conn: &mut DbConnection, rolling_stock_id: i64) -> Result<()> {
    RollingStockModel::delete_static_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct RollingStockLockedUpdateForm {
    /// New locked value
    pub locked: bool,
}

/// Update rolling_stock locked field
#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockLockedUpdateForm,
    responses(
        (status = 204, description = "No content when successful")
    )
)]
async fn update_locked(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_id): Path<i64>,
    Json(RollingStockLockedUpdateForm { locked }): Json<RollingStockLockedUpdateForm>,
) -> Result<impl IntoResponse> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    // FIXME: check that the rolling stock exists (the Option<RollingStockModel> is ignored here)
    // should return a 404 instead of a 204 in case the identifier doesn't exist.
    RollingStockModel::changeset()
        .locked(locked)
        .update(conn, rolling_stock_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(ToSchema)]
#[allow(unused)] // Schema only
struct RollingStockLiveryCreateForm {
    name: String,
    images: Vec<Vec<u8>>,
}

async fn parse_multipart_content(
    mut form: Multipart,
) -> Result<(String, Vec<MultipartImage>), LiveryMultipartError> {
    let mut name = None;
    let mut images = Vec::new();
    while let Some(field) = form.next_field().await? {
        let field_name = field.name().ok_or(LiveryMultipartError::MissingFieldName)?;
        if field_name == "name" {
            name = Some(
                field
                    .text()
                    .await
                    .map_err(|source| LiveryMultipartError::InvalidName { source })?,
            );
            continue;
        }
        if field_name != "images" {
            return Err(LiveryMultipartError::UnrecognizedField {
                field_name: field_name.to_owned(),
            });
        }
        let file_name = field
            .file_name()
            .ok_or(LiveryMultipartError::MissingLiveryName)?
            .to_owned();
        let data = field
            .bytes()
            .await
            .map_err(|source| LiveryMultipartError::InvalidLiveryContent { source })?
            .to_vec();
        images.push(MultipartImage { file_name, data });
    }
    if images.is_empty() {
        return Err(LiveryMultipartError::MissingLiveryContent);
    }
    Ok((name.ok_or(LiveryMultipartError::MissingFieldName)?, images))
}

/// Create a rolling stock livery
#[utoipa::path(
    post, path = "",
    tag = "rolling_stock,rolling_stock_livery",
    params(RollingStockIdParam),
    request_body = RollingStockLiveryCreateForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockLivery),
        (status = 404, description = "The requested rolling stock was not found"),
    )
)]
async fn create_livery(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(rolling_stock_id): Path<i64>,
    form: Multipart,
) -> Result<Json<RollingStockLivery>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let conn = &mut db_pool.get().await?;

    let (name, images) = parse_multipart_content(form)
        .await
        .map_err(RollingStockError::from)?;

    let formatted_images = format_images(images)?;

    // create compound image
    let compound_image = create_compound_image(conn, formatted_images.clone()).await?;

    // create livery
    let rolling_stock_livery: RollingStockLivery = RollingStockLiveryModel::changeset()
        .name(name)
        .rolling_stock_id(rolling_stock_id)
        .compound_image_id(Some(compound_image.id))
        .create(conn)
        .await?
        .into();

    // create separated images
    let FormattedImages { images, .. } = formatted_images;
    for (index, image) in images.into_iter().enumerate() {
        let mut w = Cursor::new(Vec::new());
        image.write_to(&mut w, ImageFormat::Png).unwrap();

        use crate::models::Create;
        let image = Document::changeset()
            .content_type(String::from("image/png"))
            .data(w.into_inner())
            .create(conn)
            .await?;

        let _ = RollingStockSeparatedImageModel::changeset()
            .image_id(image.id)
            .livery_id(rolling_stock_livery.id)
            .order(index.try_into().unwrap())
            .create(conn)
            .await?;
    }

    Ok(Json(rolling_stock_livery))
}

/// List the scenarios (and their respective studies and projects) which use a given rolling stock.
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, description = "A list of the associated scenarios and their respective studies and projects.", body = Vec<ScenarioReference>),
        (status = 404, description = "The requested rolling stock was not found"),
    )
)]
pub async fn get_usage(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(rolling_stock_id): Path<i64>,
) -> Result<Json<Vec<ScenarioReference>>> {
    let mut conn = db_pool.get().await?;

    let rolling_stock = RollingStockModel::retrieve_or_fail(&mut conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;

    let related_train_schedules = rolling_stock.get_usage(&mut conn).await?;

    Ok(Json(related_train_schedules))
}

/// Retrieve a rolling stock by id or by name
pub async fn retrieve_existing_rolling_stock(
    conn: &mut DbConnection,
    rolling_stock_key: RollingStockKey,
) -> Result<RollingStockModel> {
    match rolling_stock_key.clone() {
        RollingStockKey::Id(id) => {
            RollingStockModel::retrieve_or_fail(conn, id, || RollingStockError::KeyNotFound {
                rolling_stock_key: rolling_stock_key.clone(),
            })
            .await
        }
        RollingStockKey::Name(name) => {
            RollingStockModel::retrieve_or_fail(conn, name, || RollingStockError::KeyNotFound {
                rolling_stock_key,
            })
            .await
        }
    }
}

fn assert_rolling_stock_unlocked(rolling_stock: &RollingStockModel) -> Result<()> {
    if rolling_stock.locked {
        return Err(RollingStockError::IsLocked {
            rolling_stock_id: rolling_stock.id,
        }
        .into());
    }
    Ok(())
}

struct MultipartImage {
    file_name: String,
    data: Vec<u8>,
}

#[derive(Clone, Debug, ToSchema)]
struct FormattedImages {
    compound_image_height: u32,
    compound_image_width: u32,
    images: Vec<DynamicImage>,
}

fn format_images(mut tmp_images: Vec<MultipartImage>) -> Result<FormattedImages> {
    let mut separated_images = vec![];
    let mut max_height: u32 = 0;
    let mut total_width: u32 = 0;

    tmp_images.sort_by(|f, g| f.file_name.cmp(&g.file_name));

    for MultipartImage { data, .. } in tmp_images {
        let image = ImageReader::new(Cursor::new(data))
            .with_guessed_format()
            .unwrap();

        let image = match image.decode() {
            Ok(image) => image,
            Err(_) => return Err(RollingStockError::CannotReadImage.into()),
        };
        max_height = max_height.max(image.height());
        total_width += image.width();

        separated_images.push(image);
    }

    Ok(FormattedImages {
        compound_image_height: max_height,
        compound_image_width: total_width,
        images: separated_images,
    })
}

async fn create_compound_image(
    conn: &mut DbConnection,
    formatted_images: FormattedImages,
) -> Result<Document> {
    let FormattedImages {
        compound_image_height,
        compound_image_width,
        images,
    } = formatted_images;
    let mut compound_image = ImageBuffer::new(compound_image_width, compound_image_height);
    let mut ind_width = 0;

    // create the compound_image
    for image in images {
        match compound_image.copy_from(&image, ind_width, compound_image_height - image.height()) {
            Ok(_) => (),
            Err(_) => return Err(RollingStockError::CannotCreateCompoundImage.into()),
        };
        ind_width += image.width();
    }

    // convert compound_image to PNG
    let mut w = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(compound_image)
        .write_to(&mut w, ImageFormat::Png)
        .unwrap();

    // save the compound_image in the db
    let compound_image = Document::changeset()
        .content_type(String::from("image/png"))
        .data(w.into_inner())
        .create(conn)
        .await?;
    Ok(compound_image)
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use itertools::Itertools;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use uuid::Uuid;

    use super::*;
    use crate::error::InternalError;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_rolling_stock_with_energy_sources;
    use crate::models::fixtures::create_scenario;
    use crate::models::fixtures::create_small_infra;
    use crate::models::fixtures::create_study;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::fast_rolling_stock_changeset;
    use crate::models::fixtures::get_rolling_stock_with_invalid_effort_curves;
    use crate::models::fixtures::simple_train_schedule_changeset;
    use crate::models::rolling_stock_model::RollingStockModel;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;

    impl TestApp {
        fn rolling_stock_create_request(
            &self,
            rolling_stock_form: &RollingStockForm,
        ) -> axum_test::TestRequest {
            self.post("/rolling_stock").json(rolling_stock_form)
        }

        fn rolling_stock_get_by_id_request(&self, rolling_stock_id: i64) -> axum_test::TestRequest {
            self.get(format!("/rolling_stock/{rolling_stock_id}").as_str())
        }
    }

    pub fn fast_rolling_stock_form(name: &str) -> RollingStockForm {
        let mut form = serde_json::from_str::<RollingStockForm>(include_str!(
            "../tests/example_rolling_stock_1.json"
        ))
        .expect("Unable to parse exemple rolling stock");
        form.name = name.to_owned();
        form
    }

    #[rstest]
    async fn create_rolling_stock_successfully() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        let request = app.rolling_stock_create_request(&fast_rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: RollingStockModel = raw_response.assert_status(StatusCode::OK).json_into();
        // Check if the rolling stock was created in the database
        let rolling_stock = RollingStockModel::retrieve(&mut db_pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve rolling stock")
            .expect("Rolling stock not found");

        assert_eq!(rolling_stock.name, rs_name);
        assert_eq!(
            fast_rolling_stock_form.startup_time,
            rolling_stock.startup_time
        );
    }

    #[rstest]
    async fn create_locked_rolling_stock_successfully() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_form = fast_rolling_stock_form(locked_rs_name);

        let request = app
            .post("/rolling_stock?locked=true")
            .json(&locked_fast_rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: RollingStockModel = raw_response.assert_status(StatusCode::OK).json_into();
        // Check if the rolling stock was created in the database with locked = true
        let rolling_stock = RollingStockModel::retrieve(&mut db_pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve rolling stock")
            .expect("Rolling stock not found");

        assert_eq!(rolling_stock.name, locked_rs_name);
        assert_eq!(rolling_stock.locked, true);
    }

    #[rstest]
    async fn create_rolling_stock_with_duplicate_name() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let _ = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        let new_fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        let request = app.rolling_stock_create_request(&new_fast_rolling_stock_form);

        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:NameAlreadyUsed"
        );
    }

    #[rstest]
    async fn get_rolling_stock_usage_with_no_usage_returns_empty_ok() {
        let app = TestAppBuilder::default_app();
        let stock_name = Uuid::new_v4().to_string();
        let rolling_stock = fast_rolling_stock_form(stock_name.as_str());
        let request = app.rolling_stock_create_request(&rolling_stock);
        let RollingStockModel { id, .. } =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let request = app.get(&format!("/rolling_stock/{id}/usage"));
        let related_schedules: Vec<ScenarioReference> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert!(related_schedules.is_empty());
    }

    #[rstest]
    async fn get_rolling_stock_usage_with_related_schedules_returns_schedules_list() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let create_rolling_stock_request =
            app.rolling_stock_create_request(&fast_rolling_stock_form(&Uuid::new_v4().to_string()));
        let rolling_stock: RollingStockModel = app
            .fetch(create_rolling_stock_request)
            .assert_status(StatusCode::OK)
            .json_into();
        let create_other_rolling_stock_request =
            app.rolling_stock_create_request(&fast_rolling_stock_form(&Uuid::new_v4().to_string()));
        let other_rolling_stock: RollingStockModel = app
            .fetch(create_other_rolling_stock_request)
            .assert_status(StatusCode::OK)
            .json_into();

        let project = create_project(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let study = create_study(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            project.id,
        )
        .await;
        let timetable_1 = create_timetable(&mut db_pool.get_ok()).await;
        let timetable_2 = create_timetable(&mut db_pool.get_ok()).await;
        let timetable_3 = create_timetable(&mut db_pool.get_ok()).await;
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let scenario_1 = create_scenario(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            study.id,
            timetable_1.id,
            infra.id,
        )
        .await;
        let scenario_2 = create_scenario(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            study.id,
            timetable_2.id,
            infra.id,
        )
        .await;
        // scenario_3 will not use the required rolling stock and should thus not be queried
        let _scenario_3 = create_scenario(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            study.id,
            timetable_3.id,
            infra.id,
        )
        .await;

        simple_train_schedule_changeset(timetable_1.id)
            .rolling_stock_name(rolling_stock.name.clone())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        simple_train_schedule_changeset(timetable_2.id)
            .rolling_stock_name(rolling_stock.name)
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        simple_train_schedule_changeset(timetable_3.id)
            .rolling_stock_name(other_rolling_stock.name)
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        let request = app.get(&format!("/rolling_stock/{}/usage", rolling_stock.id));
        let related_scenarios: Vec<ScenarioReference> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let expected_scenarios = [
            ScenarioReference {
                project_id: project.id,
                project_name: project.name.clone(),
                study_id: study.id,
                study_name: study.name.clone(),
                scenario_id: scenario_1.id,
                scenario_name: scenario_1.name.clone(),
            },
            ScenarioReference {
                project_id: project.id,
                project_name: project.name.clone(),
                study_id: study.id,
                study_name: study.name.clone(),
                scenario_id: scenario_2.id,
                scenario_name: scenario_2.name.clone(),
            },
        ];
        assert_eq!(
            related_scenarios.iter().sorted().collect_vec(),
            expected_scenarios.iter().sorted().collect_vec()
        );
    }

    #[rstest]
    async fn get_invalid_rolling_stock_id_returns_404_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let _ = RollingStockModel::delete_static(&mut db_pool.get_ok(), 1).await;

        let request = app.get("/rolling_stock/1/usage");
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn create_rolling_stock_with_base_power_class_empty() {
        // GIVEN
        let app = TestAppBuilder::default_app();

        let rs_name = "fast_rolling_stock_name";
        let mut fast_rolling_stock_form = fast_rolling_stock_form(rs_name);
        fast_rolling_stock_form.base_power_class = Some("".to_string());

        let request = app.rolling_stock_create_request(&fast_rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: InternalError = raw_response
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:BasePowerClassEmpty"
        );
    }

    #[rstest]
    async fn create_rolling_stock_with_invalid_effort_curve() {
        let app = TestAppBuilder::default_app();

        let invalid_payload = get_rolling_stock_with_invalid_effort_curves();

        let request = app
            .post("/rolling_stock")
            .add_header(
                axum::http::header::CONTENT_TYPE,
                axum::http::header::HeaderValue::from_str("application/json").unwrap(),
            )
            .bytes(invalid_payload.into());

        app.fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[rstest]
    async fn get_rolling_stock_by_id() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        let request = app.rolling_stock_get_by_id_request(fast_rolling_stock.id);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: RollingStockModel = raw_response.assert_status(StatusCode::OK).json_into();

        assert_eq!(response, fast_rolling_stock);
    }

    #[rstest]
    async fn get_rolling_stock_by_name() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        let request = app.get(format!("/rolling_stock/name/{rs_name}").as_str());

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: RollingStockModel = raw_response.assert_status(StatusCode::OK).json_into();

        assert_eq!(response, fast_rolling_stock);
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_by_id() {
        let app = TestAppBuilder::default_app();

        let request = app.rolling_stock_get_by_id_request(0);

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_by_name() {
        let app = TestAppBuilder::default_app();

        let request =
            app.get(format!("/rolling_stock/name/{}", "unexisting_rolling_stock_name").as_str());

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn update_unlocked_rolling_stock() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";

        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let updated_rs_name = "updated_fast_rolling_stock_name";
        rolling_stock_form.name = updated_rs_name.to_string();

        let request = app
            .patch(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .json(&&rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        raw_response.assert_status(StatusCode::OK);

        let updated_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(updated_rolling_stock.name, updated_rs_name);
        assert_eq!(
            updated_rolling_stock.version,
            fast_rolling_stock.version + 1
        );
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let first_rs_name = "first_fast_rolling_stock_name";
        let first_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), first_rs_name).await;

        let second_rs_name = "second_fast_rolling_stock_name";
        let second_fast_rolling_stock =
            create_rolling_stock_with_energy_sources(&mut db_pool.get_ok(), second_rs_name).await;

        let second_fast_rolling_stock_form: RollingStockForm = second_fast_rolling_stock.into();

        let request = app
            .patch(format!("/rolling_stock/{}", first_fast_rolling_stock.id).as_str())
            .json(&second_fast_rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: InternalError = raw_response
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:NameAlreadyUsed"
        );
    }

    #[rstest]
    #[serial_test::serial]
    async fn update_locked_rolling_stock_fails() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let mut second_fast_rolling_stock_form: RollingStockForm = serde_json::from_str(
            include_str!("../tests/example_rolling_stock_2_energy_sources.json"),
        )
        .expect("Unable to parse rolling stock with energy sources");
        second_fast_rolling_stock_form.name = "second_fast_rolling_stock_name".to_owned();

        let request = app
            .patch(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str())
            .json(&second_fast_rolling_stock_form);

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: InternalError = raw_response.assert_status(StatusCode::CONFLICT).json_into();
        assert_eq!(response.error_type, "editoast:rollingstocks:IsLocked");
    }

    #[rstest]
    async fn patch_lock_rolling_stock_successfully() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        assert!(!fast_rolling_stock.locked);

        let request = app
            .patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }));

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let fast_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(fast_rolling_stock.locked, true)
    }

    #[rstest]
    #[serial_test::serial]
    async fn patch_unlock_rolling_stock_successfully() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        assert!(locked_fast_rolling_stock.locked);

        let request = app
            .patch(format!("/rolling_stock/{}/locked", locked_fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": false }));

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let fast_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), locked_fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert!(!fast_rolling_stock.locked);
    }

    #[rstest]
    async fn get_power_restrictions_list() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        let power_restrictions = fast_rolling_stock.power_restrictions.clone();

        let request = app.get("/rolling_stock/power_restrictions");

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: Vec<String> = raw_response.assert_status(StatusCode::OK).json_into();
        let power_restrictions = serde_json::to_string(&power_restrictions)
            .expect("Failed to convert power_restrictions to string");
        assert!(power_restrictions.contains(&"C2".to_string()));
        assert!(power_restrictions.contains(&"C5".to_string()));
        assert!(response.contains(&"C2".to_string()));
        assert!(response.contains(&"C5".to_string()));
    }

    #[rstest]
    #[serial_test::serial]
    async fn delete_locked_rolling_stock_fails() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let request =
            app.delete(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str());

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: InternalError = raw_response.assert_status(StatusCode::CONFLICT).json_into();

        assert_eq!(response.error_type, "editoast:rollingstocks:IsLocked");

        let rolling_stock_exists =
            RollingStockModel::exists(&mut db_pool.get_ok(), locked_fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(rolling_stock_exists);
    }

    #[rstest]
    #[serial_test::serial]
    async fn delete_unlocked_unused_rolling_stock_succeeds() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        assert!(!fast_rolling_stock.locked);

        let request = app.delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str());

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        raw_response.assert_status(StatusCode::NO_CONTENT);

        let rolling_stock_exists =
            RollingStockModel::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(!rolling_stock_exists);
    }

    #[rstest]
    #[serial_test::serial]
    async fn delete_unlocked_used_rolling_stock_requires_force_flag() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        assert!(!fast_rolling_stock.locked);

        let project = create_project(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let study = create_study(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            project.id,
        )
        .await;
        let timetable = create_timetable(&mut db_pool.get_ok()).await;
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        create_scenario(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            study.id,
            timetable.id,
            infra.id,
        )
        .await;

        simple_train_schedule_changeset(timetable.id)
            .rolling_stock_name(fast_rolling_stock.name.clone())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule");

        let request = app.delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str());
        let request_forced =
            app.delete(format!("/rolling_stock/{}?force=true", fast_rolling_stock.id).as_str());

        // WHEN
        let raw_response = app.fetch(request);

        // THEN
        let response: InternalError = raw_response.assert_status(StatusCode::CONFLICT).json_into();
        assert_eq!(response.error_type, "editoast:rollingstocks:IsUsed");

        let rolling_stock_exists =
            RollingStockModel::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(rolling_stock_exists);

        // WHEN
        let raw_response_forced = app.fetch(request_forced);

        // THEN
        raw_response_forced.assert_status(StatusCode::NO_CONTENT);

        let rolling_stock_exists =
            RollingStockModel::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(!rolling_stock_exists);
    }
}
