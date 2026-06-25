pub(in crate::views) mod light;
pub(in crate::views) mod towed;

type RollingStockForm = schemas::RollingStock<schemas::rolling_stock::RollingResistancePerWeight>;

use authz::RollingStockPrivilege;
use authz::v2::rolling_stock_privileges;
use axum::Extension;

use std::io::Cursor;
use std::sync::Arc;

use authz::Role;
use axum::extract::Json;
use axum::extract::Multipart;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::Document;
use editoast_models::RollingStockImage;
use editoast_models::prelude::*;
use editoast_models::rolling_stock;
use editoast_models::rolling_stock::RollingStock;
use editoast_models::rolling_stock::ScenarioReference;
use editoast_models::rolling_stock_livery::RollingStockLivery;
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

use crate::AppState;
use crate::error::InternalError;
use crate::error::Result;

#[derive(Debug, Serialize, ToSchema)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    #[schema(value_type = RollingStock)]
    pub rolling_stock: RollingStock,
    #[schema(value_type = Vec<RollingStockLivery>)]
    pub liveries: Vec<schemas::rolling_stock::RollingStockLivery>,
}

impl RollingStockWithLiveries {
    async fn try_fetch(conn: &mut DbConnection, rolling_stock: RollingStock) -> Result<Self> {
        let rolling_stock_id = rolling_stock.id;
        let liveries = RollingStockLivery::list(
            conn,
            SelectionSettings::new()
                .filter(move || RollingStockLivery::ROLLING_STOCK_ID.eq(rolling_stock_id)),
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

#[derive(Debug, Clone, PartialEq, Display, Serialize)]
#[serde(tag = "type", content = "key")]
pub enum RollingStockKey {
    Id(i64),
    Name(String),
}

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "rollingstocks")]
pub enum RollingStockError {
    #[error("Impossible to read the separated image")]
    #[editoast_error(status = 500)]
    CannotReadImage,

    #[error("Impossible to copy the separated image on the compound image")]
    #[editoast_error(status = 500)]
    CannotCreateCompoundImage,

    #[error("Invalid livery import payload: {0}")]
    #[editoast_error(status = 400)]
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

    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(editoast_models::Error, database::DatabaseError)]
    Database(editoast_models::Error),
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

// This implementation could be generated rather trivially...
impl From<rolling_stock::Error> for RollingStockError {
    fn from(e: rolling_stock::Error) -> Self {
        match e {
            rolling_stock::Error::NameAlreadyUsed { name } => Self::NameAlreadyUsed { name },
            rolling_stock::Error::BasePowerClassEmpty => Self::BasePowerClassEmpty,
            rolling_stock::Error::Database(error) => Self::Database(error),
        }
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
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
pub(in crate::views) async fn get(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(rolling_stock_id): Path<i64>,
) -> Result<Json<RollingStockWithLiveries>> {
    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(regulator.openfga());
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock_id)),
            &RollingStockPrivilege::CanRead,
        )
        .await?;
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
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
pub(in crate::views) async fn get_by_name(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(rolling_stock_name): Path<String>,
) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock = retrieve_existing_rolling_stock(
        &mut db_pool.get().await?,
        RollingStockKey::Name(rolling_stock_name),
    )
    .await?;

    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(regulator.openfga());
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock.id)),
            &RollingStockPrivilege::CanRead,
        )
        .await?;
    }

    let rolling_stock_with_liveries =
        RollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(rolling_stock_with_liveries))
}

/// Returns the set of power restrictions for all rolling_stocks modes.
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    responses(
        (status = 200, description = "Retrieve the power restrictions list", body = Vec<String>)
    )
)]
pub(in crate::views) async fn get_power_restrictions(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<Json<Vec<String>>> {
    let conn = &mut db_pool.get().await?;
    let power_restrictions = RollingStock::get_power_restrictions(conn).await?;
    Ok(Json(
        power_restrictions
            .into_iter()
            .map(|pr| pr.power_restriction)
            .collect(),
    ))
}

#[derive(Debug, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct PostRollingStockQueryParams {
    #[serde(default)]
    locked: bool,
}

/// Create a rolling stock
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "rolling_stock",
    params(PostRollingStockQueryParams),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStock)
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Query(query_params): Query<PostRollingStockQueryParams>,
    Json(rolling_stock_form): Json<RollingStockForm>,
) -> Result<Json<RollingStock>> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock_changeset: Changeset<RollingStock> = rolling_stock_form.into();

    let rolling_stock = rolling_stock_changeset
        .locked(query_params.locked)
        .version(0)
        .create(conn)
        .await
        .map_err(RollingStockError::from)?;

    Ok(Json(rolling_stock))
}

/// Modify a rolling stock
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    put, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockWithLiveries)
    )
)]
pub(in crate::views) async fn update(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(rolling_stock_id): Path<i64>,
    Json(rolling_stock_form): Json<RollingStockForm>,
) -> Result<Json<RollingStockWithLiveries>> {
    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(regulator.openfga());
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock_id)),
            &RollingStockPrivilege::CanWrite,
        )
        .await?;
    }
    let new_rolling_stock = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _, _>(async move |conn| {
            let previous_rolling_stock =
                RollingStock::retrieve_or_fail(conn.clone(), rolling_stock_id, || {
                    RollingStockError::KeyNotFound {
                        rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
                    }
                })
                .await?;
            assert_rolling_stock_unlocked(&previous_rolling_stock)?;

            if rolling_stock_form != previous_rolling_stock.clone().into() {
                let mut rolling_stock_changeset: Changeset<RollingStock> =
                    rolling_stock_form.into();
                rolling_stock_changeset.version = Some(&previous_rolling_stock.version + 1);
                let new_rolling_stock = rolling_stock_changeset
                    .update(&mut conn.clone(), rolling_stock_id)
                    .await
                    .map_err(RollingStockError::from)?
                    .ok_or(RollingStockError::KeyNotFound {
                        rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
                    })?;
                Ok(new_rolling_stock)
            } else {
                Ok(previous_rolling_stock)
            }
        })
        .await?;

    let new_rolling_stock_with_liveries =
        RollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, new_rolling_stock).await?;

    Ok(Json(new_rolling_stock_with_liveries))
}

#[derive(Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct DeleteRollingStockQueryParams {
    /// force the deletion even if it's used
    #[serde(default)]
    force: bool,
}

/// Delete a rolling_stock and all entities linked to it
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam, DeleteRollingStockQueryParams),
    responses(
        (status = 204, description = "The rolling stock was deleted successfully"),
        (status = 404, description = "The requested rolling stock is locked"),
        (status = 404, description = "The requested rolling stock was not found"),
        (status = 409, description = "The requested rolling stock is used"),
    )
)]
pub(in crate::views) async fn delete(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(rolling_stock_id): Path<i64>,
    Query(DeleteRollingStockQueryParams { force }): Query<DeleteRollingStockQueryParams>,
) -> Result<impl IntoResponse> {
    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(regulator.openfga());
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock_id)),
            &RollingStockPrivilege::CanDelete,
        )
        .await?;
    }

    let conn = &mut db_pool.get().await?;

    let rolling_stock = RollingStock::retrieve_or_fail(conn.clone(), rolling_stock_id, || {
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
    RollingStock::delete_static_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub(in crate::views) struct RollingStockLockedUpdateForm {
    /// New locked value
    pub locked: bool,
}

/// Update rolling_stock locked field
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockLockedUpdateForm,
    responses(
        (status = 204, description = "No content when successful")
    )
)]
pub(in crate::views) async fn update_locked(
    State(AppState {
        regulator, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(rolling_stock_id): Path<i64>,
    Json(RollingStockLockedUpdateForm { locked }): Json<RollingStockLockedUpdateForm>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(regulator.openfga());
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock_id)),
            &RollingStockPrivilege::CanWrite,
        )
        .await?;
    };
    RollingStock::changeset()
        .locked(locked)
        .update_or_fail(conn, rolling_stock_id, || RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        })
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
#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tags = ["rolling_stock", "rolling_stock_livery"],
    params(RollingStockIdParam),
    request_body(content = RollingStockLiveryCreateForm, content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockLivery),
        (status = 404, description = "The requested rolling stock was not found"),
    )
)]
pub(in crate::views) async fn create_livery(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(rolling_stock_id): Path<i64>,
    form: Multipart,
) -> Result<Json<schemas::rolling_stock::RollingStockLivery>> {
    let conn = &mut db_pool.get().await?;

    let (name, images) = parse_multipart_content(form)
        .await
        .map_err(RollingStockError::from)?;

    let formatted_images = format_images(images)?;

    // create compound image
    let compound_image = create_compound_image(conn, formatted_images.clone()).await?;

    // create livery
    let rolling_stock_livery: schemas::rolling_stock::RollingStockLivery =
        RollingStockLivery::changeset()
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

        let image = Document::changeset()
            .content_type(String::from("image/png"))
            .data(w.into_inner())
            .create(conn)
            .await?;

        let _ = RollingStockImage::changeset()
            .image_id(image.id)
            .livery_id(rolling_stock_livery.id)
            .order(index.try_into().unwrap())
            .create(conn)
            .await?;
    }

    Ok(Json(rolling_stock_livery))
}

/// List the scenarios (and their respective studies and projects) which use a given rolling stock.
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, description = "A list of the associated scenarios and their respective studies and projects.", body = Vec<ScenarioReference>),
        (status = 404, description = "The requested rolling stock was not found"),
    )
)]
pub(in crate::views) async fn get_usage(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(rolling_stock_id): Path<i64>,
) -> Result<Json<Vec<ScenarioReference>>> {
    let mut conn = db_pool.get().await?;

    let rolling_stock = RollingStock::retrieve_or_fail(conn.clone(), rolling_stock_id, || {
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
) -> Result<RollingStock, RollingStockError> {
    match rolling_stock_key.clone() {
        RollingStockKey::Id(id) => {
            RollingStock::retrieve_or_fail(conn.clone(), id, || RollingStockError::KeyNotFound {
                rolling_stock_key: rolling_stock_key.clone(),
            })
            .await
        }
        RollingStockKey::Name(name) => {
            RollingStock::retrieve_or_fail(conn.clone(), name, || RollingStockError::KeyNotFound {
                rolling_stock_key,
            })
            .await
        }
    }
}

fn assert_rolling_stock_unlocked(rolling_stock: &RollingStock) -> Result<()> {
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

#[derive(Clone, Debug)]
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
    use authz::RollingStockGrant;
    use editoast_models::rolling_stock::TrainMainCategory;
    use itertools::Itertools;
    use pretty_assertions::assert_eq;
    use serde_json::json;
    use uuid::Uuid;

    use super::*;
    use crate::error::InternalError;
    use crate::fixtures::create_fast_rolling_stock;
    use crate::fixtures::create_project;
    use crate::fixtures::create_rolling_stock_with_energy_sources;
    use crate::fixtures::create_scenario;
    use crate::fixtures::create_small_infra;
    use crate::fixtures::create_study;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::fixtures::simple_paced_train_changeset;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt;
    use editoast_models::rolling_stock::RollingStock;

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
        let mut form = schemas::fixtures::fast_rolling_stock();
        form.name = name.to_owned();
        form
    }

    pub fn simple_etcs_level2_rolling_stock() -> RollingStockForm {
        serde_json::from_str::<RollingStockForm>(include_str!(
            "../../../tests/data/rolling_stocks/etcs_level2_rolling_stock.json"
        ))
        .expect("Unable to parse example rolling stock")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_successfully() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        // WHEN
        let raw_response = app
            .rolling_stock_create_request(&fast_rolling_stock_form)
            .await;

        // THEN
        let response: RollingStock = raw_response.assert_status_ok().json();
        // Check if the rolling stock was created in the database
        let rolling_stock = RollingStock::retrieve(db_pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve rolling stock")
            .expect("Rolling stock not found");

        assert_eq!(rolling_stock.name, rs_name);
        assert_eq!(
            fast_rolling_stock_form.startup_time,
            rolling_stock.startup_time
        );
        let rolling_stock: RollingStockForm = rolling_stock.into();
        assert_eq!(
            rolling_stock
                .supported_signaling_systems()
                .contains("ETCS_LEVEL2"),
            false
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_locked_rolling_stock_successfully() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_form = fast_rolling_stock_form(locked_rs_name);

        // WHEN
        let raw_response = app
            .post("/rolling_stock?locked=true")
            .json(&locked_fast_rolling_stock_form)
            .await;

        // THEN
        let response: RollingStock = raw_response.assert_status_ok().json();
        // Check if the rolling stock was created in the database with locked = true
        let rolling_stock = RollingStock::retrieve(db_pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve rolling stock")
            .expect("Rolling stock not found");

        assert_eq!(rolling_stock.name, locked_rs_name);
        assert_eq!(rolling_stock.locked, true);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_duplicate_name() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let _ = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        let new_fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        let response: InternalError = app
            .rolling_stock_create_request(&new_fast_rolling_stock_form)
            .await
            .assert_status_bad_request()
            .json();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:NameAlreadyUsed"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_usage_with_no_usage_returns_empty_ok() {
        let app = test_app!().skip_authz().build();
        let stock_name = Uuid::new_v4().to_string();
        let rolling_stock = fast_rolling_stock_form(stock_name.as_str());
        let RollingStock { id, .. } = app
            .rolling_stock_create_request(&rolling_stock)
            .await
            .assert_status_ok()
            .json();
        let related_schedules: Vec<ScenarioReference> = app
            .get(&format!("/rolling_stock/{id}/usage"))
            .await
            .assert_status_ok()
            .json();
        assert!(related_schedules.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_usage_with_related_schedules_returns_schedules_list() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let create_rolling_stock_request =
            app.rolling_stock_create_request(&fast_rolling_stock_form(&Uuid::new_v4().to_string()));
        let rolling_stock: RollingStock = (create_rolling_stock_request)
            .await
            .assert_status_ok()
            .json();
        let create_other_rolling_stock_request =
            app.rolling_stock_create_request(&fast_rolling_stock_form(&Uuid::new_v4().to_string()));
        let other_rolling_stock: RollingStock = (create_other_rolling_stock_request)
            .await
            .assert_status_ok()
            .json();

        let project = create_project(&mut db_pool.get_ok(), &Uuid::new_v4().to_string()).await;
        let study = create_study(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            project.id,
        )
        .await;

        let (timetable_1, train_schedule_set_1) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

        let (timetable_2, train_schedule_set_2) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let (timetable_3, train_schedule_set_3) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;

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

        simple_paced_train_changeset(train_schedule_set_1.id)
            .rolling_stock_name(rolling_stock.name.clone())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        simple_paced_train_changeset(train_schedule_set_2.id)
            .rolling_stock_name(rolling_stock.name)
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();
        simple_paced_train_changeset(train_schedule_set_3.id)
            .rolling_stock_name(other_rolling_stock.name)
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        let related_scenarios: Vec<ScenarioReference> = app
            .get(&format!("/rolling_stock/{}/usage", rolling_stock.id))
            .await
            .assert_status_ok()
            .json();
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_invalid_rolling_stock_id_returns_404_not_found() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let _ = RollingStock::delete_static(&mut db_pool.get_ok(), 1).await;

        app.get("/rolling_stock/1/usage")
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_base_power_class_empty() {
        // GIVEN
        let app = test_app!().skip_authz().build();

        let rs_name = "fast_rolling_stock_name";
        let mut fast_rolling_stock_form = fast_rolling_stock_form(rs_name);
        fast_rolling_stock_form.base_power_class = Some("".to_string());

        // WHEN
        let raw_response = app
            .rolling_stock_create_request(&fast_rolling_stock_form)
            .await;

        // THEN
        let response: InternalError = raw_response.assert_status_bad_request().json();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:BasePowerClassEmpty"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_invalid_effort_curve() {
        let app = test_app!().skip_authz().build();

        let invalid_payload = schemas::fixtures::rolling_stock_with_invalid_effort_curves_json();

        app.post("/rolling_stock")
            .add_header(
                axum::http::header::CONTENT_TYPE,
                axum::http::header::HeaderValue::from_str("application/json").unwrap(),
            )
            .bytes(invalid_payload.into())
            .await
            .assert_status_unprocessable_entity();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_etcs_brake_params() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let rolling_stock_form = simple_etcs_level2_rolling_stock();

        // WHEN
        let response: RollingStock = app
            .rolling_stock_create_request(&rolling_stock_form)
            .await
            .assert_status_ok()
            .json();
        // Check if the rolling stock was created in the database
        let rolling_stock = RollingStock::retrieve(db_pool.get_ok(), response.id)
            .await
            .expect("Failed to retrieve rolling stock")
            .expect("Rolling stock not found");

        let rolling_stock: RollingStockForm = rolling_stock.into();

        // THEN
        assert_eq!(
            rolling_stock
                .supported_signaling_systems()
                .contains("ETCS_LEVEL2"),
            true
        );

        assert_eq!(rolling_stock.name, rolling_stock_form.name);
        assert_eq!(rolling_stock_form.startup_time, rolling_stock.startup_time);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_by_id() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // a user with the role to reach the endpoint and a read grant on the rolling stock
        let user = app
            .user("authorized", "Authorized")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Reader)
            .create()
            .await;

        // WHEN
        let raw_response = app
            .rolling_stock_get_by_id_request(fast_rolling_stock.id)
            .by_user(&user.info)
            .await;

        // THEN
        let response: RollingStock = raw_response.assert_status_ok().json();

        assert_eq!(response, fast_rolling_stock);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_by_id_with_privilege_and_no_roles() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_name").await;

        // a user that does not have the role to reach the endpoint but has a read grant on the rolling stock
        let user = app
            .user("unauthorized", "Unauthorized")
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Reader)
            .create()
            .await;

        app.rolling_stock_get_by_id_request(fast_rolling_stock.id)
            .by_user(&user.info)
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_by_id_without_permission() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_name").await;

        // a user that has the role to reach the endpoint but no read grant on the rolling stock
        let user = app
            .user("unauthorized", "Unauthorized")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.rolling_stock_get_by_id_request(fast_rolling_stock.id)
            .by_user(&user.info)
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_rolling_stock_by_name() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // WHEN
        let raw_response = app
            .get(format!("/rolling_stock/name/{rs_name}").as_str())
            .await;

        // THEN
        let response: RollingStock = raw_response.assert_status_ok().json();

        assert_eq!(response, fast_rolling_stock);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_rolling_stock_by_id() {
        let app = test_app!().skip_authz().build();

        app.rolling_stock_get_by_id_request(0)
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_rolling_stock_by_name() {
        let app = test_app!().skip_authz().build();

        app.get(format!("/rolling_stock/name/{}", "unexisting_rolling_stock_name").as_str())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_unlocked_rolling_stock() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";

        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let updated_rs_name = "updated_fast_rolling_stock_name";
        rolling_stock_form.name = updated_rs_name.to_string();

        // WHEN
        app.put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(user.as_ref())
            .json(&&rolling_stock_form)
            .await
            .assert_status_ok();

        // THEN
        let updated_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(updated_rolling_stock.name, updated_rs_name);
        assert_eq!(
            updated_rolling_stock.version,
            fast_rolling_stock.version + 1
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_without_authorization() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "unauthorized_rolling_stock").await;

        // A user with the OperationalStudies role but only a read grant on the rolling stock
        let user = app
            .user("reader", "Reader")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Reader)
            .create()
            .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        rolling_stock_form.name = "should_not_be_updated".to_string();

        app.put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(user.as_ref())
            .json(&&rolling_stock_form)
            .await
            .assert_status_forbidden();

        // The rolling stock should not have been modified
        let rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(rolling_stock.name, fast_rolling_stock.name);
        assert_eq!(rolling_stock.version, fast_rolling_stock.version);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_as_admin_without_grant() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "admin_updated_rolling_stock").await;

        // An admin holds no grant on the rolling stock but can still update it
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let updated_rs_name = "updated_by_admin";
        rolling_stock_form.name = updated_rs_name.to_string();

        // WHEN
        app.put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(admin.as_ref())
            .json(&&rolling_stock_form)
            .await
            .assert_status_ok();

        // THEN
        let updated_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert_eq!(updated_rolling_stock.name, updated_rs_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_with_skip_authz_without_grant() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "skip_authz_updated_rolling_stock")
                .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let updated_rs_name = "updated_with_skip_authz";
        rolling_stock_form.name = updated_rs_name.to_string();

        // WHEN (no grant set up, authorization is skipped)
        app.put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .json(&&rolling_stock_form)
            .await
            .assert_status_ok();

        // THEN
        let updated_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert_eq!(updated_rolling_stock.name, updated_rs_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_without_operational_studies_role() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "missing_role_rolling_stock").await;

        // A user with the right write grant but lacking the OperationalStudies role
        let user = app
            .user("writer", "Writer")
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        rolling_stock_form.name = "should_not_be_updated".to_string();

        // WHEN
        app.put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(user.as_ref())
            .json(&&rolling_stock_form)
            .await
            .assert_status_forbidden();

        // THEN the rolling stock should not have been modified
        let rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert_eq!(rolling_stock.name, fast_rolling_stock.name);
        assert_eq!(rolling_stock.version, fast_rolling_stock.version);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_with_new_categories() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_with_categories")
                .await;

        assert_eq!(
            fast_rolling_stock.primary_category,
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain,)
        );
        assert_eq!(fast_rolling_stock.other_categories, vec![]);

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let primary_category =
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain);
        rolling_stock_form.primary_category = *primary_category.clone();
        let other_categories = vec![schemas::rolling_stock::TrainMainCategory::RegionalTrain];
        rolling_stock_form.other_categories = other_categories;

        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        // WHEN
        let raw_response = app
            .put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .json(&&rolling_stock_form)
            .by_user(user.as_ref())
            .await;

        // THEN
        raw_response.assert_status_ok();

        let updated_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(
            updated_rolling_stock.version,
            fast_rolling_stock.version + 1
        );
        assert_eq!(updated_rolling_stock.primary_category, primary_category);
        assert_eq!(
            updated_rolling_stock.other_categories,
            vec![TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::RegionalTrain
            )]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_categories_should_fail_when_invalid() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_with_categories")
                .await;

        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let primary_category =
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain);
        rolling_stock_form.primary_category = *primary_category.clone();
        let other_categories = vec![*primary_category.clone()];
        rolling_stock_form.other_categories = other_categories.clone();

        // WHEN
        let raw_response = app
            .put(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .json(&&rolling_stock_form)
            .by_user(user.as_ref())
            .await;

        // THEN
        let response = raw_response.assert_status_unprocessable_entity().text();
        assert_eq!(
            response,
            "Failed to deserialize the JSON body into the target type: invalid rolling-stock: primary_category: The primary_category cannot be listed in other_categories for rolling stocks."
        );

        let updated_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(updated_rolling_stock.version, fast_rolling_stock.version);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_failure_name_already_used() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let first_rs_name = "first_fast_rolling_stock_name";
        let first_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), first_rs_name).await;

        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(first_fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;
        let second_rs_name = "second_fast_rolling_stock_name";
        let second_fast_rolling_stock =
            create_rolling_stock_with_energy_sources(&mut db_pool.get_ok(), second_rs_name).await;

        let second_fast_rolling_stock_form: RollingStockForm = second_fast_rolling_stock.into();

        // WHEN
        let raw_response = app
            .put(format!("/rolling_stock/{}", first_fast_rolling_stock.id).as_str())
            .json(&second_fast_rolling_stock_form)
            .by_user(user.as_ref())
            .await;

        // THEN
        let response: InternalError = raw_response.assert_status_bad_request().json();

        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:NameAlreadyUsed"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_locked_rolling_stock_fails() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name(locked_rs_name.to_owned())
                .locked(true)
                .version(0);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(locked_fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        let mut second_fast_rolling_stock_form: RollingStockForm =
            schemas::fixtures::fast_rolling_stock();
        second_fast_rolling_stock_form.name = "second_fast_rolling_stock_name".to_owned();

        // WHEN
        let raw_response = app
            .put(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str())
            .json(&second_fast_rolling_stock_form)
            .by_user(user.as_ref())
            .await;

        // THEN
        let response: InternalError = raw_response.assert_status_conflict().json();
        assert_eq!(response.error_type, "editoast:rollingstocks:IsLocked");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_lock_rolling_stock_failed() {
        let app = test_app!().skip_authz().build();

        let id: i64 = rand::random();
        app.patch(&format!("/rolling_stock/{id}/locked"))
            .json(&json!({ "locked": true }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_lock_rolling_stock_successfully() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        let user = app
            .user("authorized", "Authorized")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Owner)
            .create()
            .await;
        assert!(!fast_rolling_stock.locked);

        app.patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }))
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(fast_rolling_stock.locked, true)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_unlock_rolling_stock_successfully() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name(locked_rs_name.to_owned())
                .locked(true)
                .version(0);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        assert!(locked_fast_rolling_stock.locked);

        let user = app
            .user("authorized", "Authorized")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(
                locked_fast_rolling_stock.id,
                authz::RollingStockGrant::Owner,
            )
            .create()
            .await;

        app.patch(format!("/rolling_stock/{}/locked", locked_fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": false }))
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), locked_fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert!(!fast_rolling_stock.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_locked_rolling_stock_without_sufficient_grant() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "unauthorized_rolling_stock").await;
        assert!(!fast_rolling_stock.locked);

        // A user with the OperationalStudies role but only a read grant on the rolling stock
        let user = app
            .user("reader", "Reader")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Reader)
            .create()
            .await;

        // WHEN
        app.patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }))
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();

        // THEN the locked flag should not have changed
        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert!(!fast_rolling_stock.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_locked_rolling_stock_as_admin_without_grant() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "admin_locked_rolling_stock").await;
        assert!(!fast_rolling_stock.locked);

        // An admin holds no grant on the rolling stock but can still lock it
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        // WHEN
        app.patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }))
            .by_user(admin.as_ref())
            .await
            .assert_status_no_content();

        // THEN
        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert!(fast_rolling_stock.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_locked_rolling_stock_with_skip_authz_without_grant() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "skip_authz_locked_rolling_stock")
                .await;
        assert!(!fast_rolling_stock.locked);

        // WHEN (no grant set up, authorization is skipped)
        app.patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }))
            .await
            .assert_status_no_content();

        // THEN
        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert!(fast_rolling_stock.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn patch_locked_rolling_stock_without_operational_studies_role() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "missing_role_rolling_stock").await;
        assert!(!fast_rolling_stock.locked);

        // A user with a write grant but lacking the OperationalStudies role
        let user = app
            .user("writer", "Writer")
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Writer)
            .create()
            .await;

        // WHEN
        app.patch(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .json(&json!({ "locked": true }))
            .by_user(&user.info)
            .await
            .assert_status_forbidden();

        // THEN the locked flag should not have changed
        let fast_rolling_stock: RollingStock =
            RollingStock::retrieve(db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");
        assert!(!fast_rolling_stock.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_power_restrictions_list() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        let power_restrictions = fast_rolling_stock.power_restrictions.clone();

        // WHEN
        let raw_response = app.get("/rolling_stock/power_restrictions").await;

        // THEN
        let response: Vec<String> = raw_response.assert_status_ok().json();
        let power_restrictions = serde_json::to_string(&power_restrictions)
            .expect("Failed to convert power_restrictions to string");
        assert!(power_restrictions.contains(&"C2".to_string()));
        assert!(power_restrictions.contains(&"C5".to_string()));
        assert!(response.contains(&"C2".to_string()));
        assert!(response.contains(&"C5".to_string()));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_locked_rolling_stock_fails() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name(locked_rs_name.to_owned())
                .locked(true)
                .version(0);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let user = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(locked_fast_rolling_stock.id, RollingStockGrant::Owner)
            .create()
            .await;
        // WHEN
        let raw_response = app
            .delete(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str())
            .by_user(&user.info)
            .await;

        // THEN
        let response: InternalError = raw_response.assert_status_conflict().json();

        assert_eq!(response.error_type, "editoast:rollingstocks:IsLocked");

        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), locked_fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_unlocked_unused_rolling_stock_succeeds() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;
        assert!(!fast_rolling_stock.locked);

        let user = app
            .user("owner", "Owner")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Owner)
            .create()
            .await;

        // WHEN
        let raw_response = app
            .delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(&user.info)
            .await;

        // THEN
        raw_response.assert_status_no_content();

        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(!rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_rolling_stock_without_authorization() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "unauthorized_rolling_stock").await;

        // A user with the OperationalStudies role but only a write grant on the rolling stock
        // (delete requires an owner/delete grant)
        let user = app
            .user("writer", "Writer")
            .with_roles([Role::OperationalStudies])
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Writer)
            .create()
            .await;

        // WHEN
        let raw_response = app
            .delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(user.as_ref())
            .await;

        // THEN
        raw_response.assert_status_forbidden();

        // The rolling stock should still exist
        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_rolling_stock_as_admin_without_grant() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "admin_deleted_rolling_stock").await;

        // An admin holds no grant on the rolling stock but can still delete it
        let admin = app
            .user("admin", "Admin")
            .with_roles([Role::Admin])
            .create()
            .await;

        // WHEN
        app.delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(admin.as_ref())
            .await
            .assert_status_no_content();

        // THEN
        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(!rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_rolling_stock_with_skip_authz_without_user() {
        // GIVEN
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "skip_authz_deleted_rolling_stock")
                .await;

        // WHEN (no grant set up, authorization is skipped)
        app.delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .await
            .assert_status_no_content();

        // THEN
        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(!rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_rolling_stock_without_operational_studies_role() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "missing_role_rolling_stock").await;

        // A user with an owner grant but lacking the OperationalStudies role
        let user = app
            .user("owner", "Owner")
            .with_rolling_stock_grant(fast_rolling_stock.id, RollingStockGrant::Owner)
            .create()
            .await;

        // WHEN
        app.delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_forbidden();

        // THEN the rolling stock should still exist
        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");
        assert!(rolling_stock_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_unlocked_used_rolling_stock_requires_force_flag() {
        // GIVEN
        let app = test_app!().skip_authz().build();
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
        let (timetable, train_schedule_set) =
            create_timetable_with_train_schedule_set(&mut db_pool.get_ok()).await;
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        create_scenario(
            &mut db_pool.get_ok(),
            &Uuid::new_v4().to_string(),
            study.id,
            timetable.id,
            infra.id,
        )
        .await;

        simple_paced_train_changeset(train_schedule_set.id)
            .rolling_stock_name(fast_rolling_stock.name.clone())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        // WHEN
        let raw_response = app
            .delete(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .await;

        // THEN
        let response: InternalError = raw_response.assert_status_conflict().json();
        assert_eq!(response.error_type, "editoast:rollingstocks:IsUsed");

        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(rolling_stock_exists);

        // WHEN
        let raw_response_forced = app
            .delete(format!("/rolling_stock/{}?force=true", fast_rolling_stock.id).as_str())
            .await;

        // THEN
        raw_response_forced.assert_status_no_content();

        let rolling_stock_exists =
            RollingStock::exists(&mut db_pool.get_ok(), fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert!(!rolling_stock_exists);
    }
}
