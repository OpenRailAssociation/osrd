pub mod light_rolling_stock;
pub mod rolling_stock_form;

use std::io::BufReader;
use std::io::Cursor;
use std::io::Read;
use std::ops::DerefMut;

use actix_multipart::form::tempfile::TempFile;
use actix_multipart::form::text::Text;
use actix_multipart::form::MultipartForm;
use actix_web::delete;
use actix_web::get;
use actix_web::patch;
use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use editoast_derive::EditoastError;
use editoast_schemas::rolling_stock::RollingStockLivery;
use editoast_schemas::rolling_stock::RollingStockLiveryMetadata;
use image::DynamicImage;
use image::GenericImage;
use image::ImageBuffer;
use image::ImageFormat;
use image::ImageReader;
use rolling_stock_form::RollingStockForm;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use strum::Display;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;
use validator::Validate;

use crate::error::InternalError;
use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryModel;
use crate::modelsv2::rolling_stock_model::TrainScheduleScenarioStudyProject;
use crate::modelsv2::Document;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::RollingStockSeparatedImageModel;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/rolling_stock" => {
        create,
        "/power_restrictions" => {
            get_power_restrictions,
        },
        "/name/{rolling_stock_name}" => {
            get_by_name,
        },
        "/{rolling_stock_id}" => {
            get,
            update,
            delete,
            "/locked" => {
                update_locked,
            },
            "/livery" => {
                create_livery,
            },
        }
    }
}

editoast_common::schemas! {
    RollingStockForm,
    DeleteRollingStockQueryParams,
    RollingStockLockedUpdateForm,
    RollingStockLiveryCreateForm,
    RollingStockError,
    RollingStockKey,
    RollingStockWithLiveries,
    light_rolling_stock::schemas(),
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    #[schema(value_type = RollingStock)]
    pub rolling_stock: RollingStockModel,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Display, ToSchema)]
#[serde(tag = "type", content = "key")]
pub enum RollingStockKey {
    Id(i64),
    Name(String),
}

#[derive(Debug, Error, EditoastError, ToSchema)]
#[editoast_error(base_id = "rollingstocks")]
pub enum RollingStockError {
    #[error("Impossible to read the separated image")]
    #[editoast_error(status = 500)]
    CannotReadImage,
    #[error("Impossible to copy the separated image on the compound image")]
    #[editoast_error(status = 500)]
    CannotCreateCompoundImage,
    #[error("Rolling stock '{rolling_stock_key}' could not be found")]
    #[editoast_error(status = 404)]
    KeyNotFound { rolling_stock_key: RollingStockKey },
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
    #[error("RollingStock '{rolling_stock_id}' is locked")]
    #[editoast_error(status = 400)]
    RollingStockIsLocked { rolling_stock_id: i64 },
    #[error("RollingStock '{rolling_stock_id}' is used")]
    #[editoast_error(status = 409)]
    RollingStockIsUsed {
        rolling_stock_id: i64,
        usage: Vec<TrainScheduleScenarioStudyProject>,
    },
    #[error("Base power class is an empty string")]
    #[editoast_error(status = 400)]
    BasePowerClassEmpty,
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
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<i64>,
) -> Result<Json<RollingStockWithLiveries>> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock_id = path.into_inner();

    let rolling_stock =
        retrieve_existing_rolling_stock(conn, RollingStockKey::Id(rolling_stock_id)).await?;
    let rolling_stock_with_liveries = rolling_stock.with_liveries(conn).await?;
    Ok(Json(rolling_stock_with_liveries))
}

/// Get a rolling stock by name
#[utoipa::path(
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
#[get("")]
async fn get_by_name(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<String>,
) -> Result<Json<RollingStockWithLiveries>> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock_name = path.into_inner();
    let rolling_stock =
        retrieve_existing_rolling_stock(conn, RollingStockKey::Name(rolling_stock_name)).await?;
    let rolling_stock_with_liveries = rolling_stock.with_liveries(conn).await?;
    Ok(Json(rolling_stock_with_liveries))
}

/// Returns the set of power restrictions for all rolling_stocks modes.
#[utoipa::path(tag = "rolling_stock",
    responses(
        (status = 200, description = "Retrieve the power restrictions list", body = Vec<String>)
    )
)]
#[get("")]
async fn get_power_restrictions(db_pool: Data<DbConnectionPoolV2>) -> Result<Json<Vec<String>>> {
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
struct PostRollingStockQueryParams {
    #[serde(default)]
    locked: bool,
}

/// Create a rolling stock
#[utoipa::path(tag = "rolling_stock",
    params(PostRollingStockQueryParams),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStock)
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbConnectionPoolV2>,
    Json(rolling_stock_form): Json<RollingStockForm>,
    query_params: Query<PostRollingStockQueryParams>,
) -> Result<Json<RollingStockModel>> {
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
#[utoipa::path(tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockWithLiveries)
    )
)]
#[patch("")]
async fn update(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<i64>,
    Json(rolling_stock_form): Json<RollingStockForm>,
) -> Result<Json<RollingStockWithLiveries>> {
    rolling_stock_form.validate()?;
    let conn = &mut db_pool.get().await?;

    let rolling_stock_id = path.into_inner();
    let name = rolling_stock_form.name.clone();

    let previous_rolling_stock =
        RollingStockModel::retrieve_or_fail(conn, rolling_stock_id, || {
            RollingStockError::KeyNotFound {
                rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
            }
        })
        .await?;
    assert_rolling_stock_unlocked(&previous_rolling_stock)?;

    let mut new_rolling_stock = Into::<Changeset<RollingStockModel>>::into(rolling_stock_form)
        .update(conn, rolling_stock_id)
        .await
        .map_err(|e| map_diesel_error(e, name.clone()))?
        .ok_or(RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        })?;

    if new_rolling_stock != previous_rolling_stock {
        new_rolling_stock.version += 1;
        new_rolling_stock
            .save(conn)
            .await
            .map_err(|err| map_diesel_error(err, name))?;
    }

    Ok(Json(new_rolling_stock.with_liveries(conn).await?))
}

#[derive(Deserialize, IntoParams, ToSchema)]
struct DeleteRollingStockQueryParams {
    /// force the deletion even if it’s used
    #[serde(default)]
    force: bool,
}

/// Delete a rolling_stock and all entities linked to it
#[utoipa::path(tag = "rolling_stock",
    params(RollingStockIdParam, DeleteRollingStockQueryParams),
    responses(
        (status = 204, description = "The rolling stock was deleted successfully"),
        (status = 404, description = "The requested rolling stock is locked"),
        (status = 404, description = "The requested rolling stock was not found"),
        (status = 409, description = "The requested rolling stock is used", body = RollingStockError),
    )
)]
#[delete("")]
async fn delete(
    db_pool: Data<DbConnectionPoolV2>,
    path: Path<i64>,
    params: Query<DeleteRollingStockQueryParams>,
) -> Result<HttpResponse> {
    let rolling_stock_id = path.into_inner();
    assert_rolling_stock_unlocked(
        &retrieve_existing_rolling_stock(
            db_pool.get().await?.deref_mut(),
            RollingStockKey::Id(rolling_stock_id),
        )
        .await?,
    )?;

    if params.force {
        return delete_rolling_stock(db_pool.get().await?.deref_mut(), rolling_stock_id).await;
    }

    let trains =
        get_rolling_stock_usage(db_pool.get().await?.deref_mut(), rolling_stock_id).await?;
    if trains.is_empty() {
        return delete_rolling_stock(db_pool.get().await?.deref_mut(), rolling_stock_id).await;
    }
    Err(RollingStockError::RollingStockIsUsed {
        rolling_stock_id,
        usage: trains,
    }
    .into())
}

async fn delete_rolling_stock(
    conn: &mut DbConnection,
    rolling_stock_id: i64,
) -> Result<HttpResponse> {
    RollingStockModel::delete_static_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct RollingStockLockedUpdateForm {
    /// New locked value
    pub locked: bool,
}

/// Update rolling_stock locked field
#[utoipa::path(tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockLockedUpdateForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStock)
    )
)]
#[patch("")]
async fn update_locked(
    db_pool: Data<DbConnectionPoolV2>,
    rolling_stock_id: Path<i64>,
    data: Json<RollingStockLockedUpdateForm>,
) -> Result<HttpResponse> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock_locked_update_form = data.into_inner();
    let rolling_stock_id = rolling_stock_id.into_inner();

    // FIXME: check that the rolling stock exists (the Option<RollingSrtockModel> is ignored here)
    RollingStockModel::changeset()
        .locked(rolling_stock_locked_update_form.locked)
        .update(conn, rolling_stock_id)
        .await?;

    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, MultipartForm, ToSchema)]
struct RollingStockLiveryCreateForm {
    #[schema(value_type=String)]
    pub name: Text<String>,
    #[schema(value_type=Vec<String>, format=Binary)]
    pub images: Vec<TempFile>,
}

async fn get_rolling_stock_usage(
    conn: &mut DbConnection,
    rolling_stock_id: i64,
) -> Result<Vec<TrainScheduleScenarioStudyProject>> {
    let rolling_stock = RollingStockModel::retrieve_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;

    rolling_stock.get_rolling_stock_usage(conn).await
}

/// Create a rolling stock livery
#[utoipa::path(tag = "rolling_stock,rolling_stock_livery",
    params(RollingStockIdParam),
    request_body = RollingStockLiveryCreateForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStockLivery),
        (status = 404, description = "The requested rolling stock was not found"),
    )
)]
#[post("")]
async fn create_livery(
    db_pool: Data<DbConnectionPoolV2>,
    rolling_stock_id: Path<i64>,
    MultipartForm(form): MultipartForm<RollingStockLiveryCreateForm>,
) -> Result<Json<RollingStockLivery>> {
    let conn = &mut db_pool.get().await?;

    let rolling_stock_id = rolling_stock_id.into_inner();

    let formatted_images = format_images(form.images)?;

    // create compound image
    let compound_image = create_compound_image(conn, formatted_images.clone()).await?;

    // create livery
    let rolling_stock_livery: RollingStockLivery = RollingStockLiveryModel::changeset()
        .name(form.name.into_inner())
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

        use crate::modelsv2::Create;
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
        return Err(RollingStockError::RollingStockIsLocked {
            rolling_stock_id: rolling_stock.id,
        }
        .into());
    }
    Ok(())
}

#[derive(Clone, Debug, ToSchema)]
struct FormattedImages {
    compound_image_height: u32,
    compound_image_width: u32,
    images: Vec<DynamicImage>,
}

fn format_images(mut tmp_images: Vec<TempFile>) -> Result<FormattedImages> {
    let mut separated_images = vec![];
    let mut max_height: u32 = 0;
    let mut total_width: u32 = 0;

    tmp_images.sort_by_key(|f| f.file_name.clone().unwrap());

    for f in tmp_images {
        let file = f.file.into_file();
        let mut reader = BufReader::new(file);
        let mut buffer = vec![];
        reader.read_to_end(&mut buffer).unwrap();

        let image = ImageReader::new(Cursor::new(buffer))
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
    use std::ops::DerefMut;
    use std::vec;

    use actix_http::Request;
    use actix_http::StatusCode;
    use actix_web::http::header::ContentType;
    use actix_web::test::TestRequest;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::RollingStockError;
    use super::TrainScheduleScenarioStudyProject;
    use crate::error::InternalError;
    use crate::models::Identifiable;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_pathfinding;
    use crate::modelsv2::fixtures::create_project;
    use crate::modelsv2::fixtures::create_rolling_stock_with_energy_sources;
    use crate::modelsv2::fixtures::create_scenario_v1;
    use crate::modelsv2::fixtures::create_study;
    use crate::modelsv2::fixtures::create_timetable_v1;
    use crate::modelsv2::fixtures::create_train_schedule_v1;
    use crate::modelsv2::fixtures::fast_rolling_stock_changeset;
    use crate::modelsv2::fixtures::fast_rolling_stock_form;
    use crate::modelsv2::fixtures::get_rolling_stock_with_invalid_effort_curves;
    use crate::modelsv2::fixtures::rolling_stock_with_energy_sources_form;
    use crate::modelsv2::prelude::*;
    use crate::modelsv2::rolling_stock_model::RollingStockModel;
    use crate::views::rolling_stocks::rolling_stock_form::RollingStockForm;
    use crate::views::test_app::TestAppBuilder;

    fn rolling_stock_create_request(rolling_stock_form: &RollingStockForm) -> Request {
        TestRequest::post()
            .uri("/rolling_stock")
            .set_json(rolling_stock_form)
            .to_request()
    }

    fn rolling_stock_get_by_id_request(rolling_stock_id: i64) -> Request {
        TestRequest::get()
            .uri(format!("/rolling_stock/{rolling_stock_id}").as_str())
            .to_request()
    }

    fn rolling_stock_delete_request(rolling_stock_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/rolling_stock/{rolling_stock_id}").as_str())
            .to_request()
    }

    #[rstest]
    async fn create_rolling_stock_successfully() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        let request = rolling_stock_create_request(&fast_rolling_stock_form);

        // WHEN
        let response: RollingStockModel =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        // Check if the rolling stock was created in the database
        let rolling_stock = RollingStockModel::retrieve(db_pool.get_ok().deref_mut(), response.id)
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

        let request = TestRequest::post()
            .uri("/rolling_stock?locked=true")
            .set_json(locked_fast_rolling_stock_form)
            .to_request();

        // WHEN
        let response: RollingStockModel =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        // Check if the rolling stock was created in the database with locked = true
        let rolling_stock = RollingStockModel::retrieve(db_pool.get_ok().deref_mut(), response.id)
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
        let _ = create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;
        let new_fast_rolling_stock_form = fast_rolling_stock_form(rs_name);

        let request = rolling_stock_create_request(&new_fast_rolling_stock_form);

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
    async fn create_rolling_stock_with_base_power_class_empty() {
        // GIVEN
        let app = TestAppBuilder::default_app();

        let rs_name = "fast_rolling_stock_name";
        let mut fast_rolling_stock_form = fast_rolling_stock_form(rs_name);
        fast_rolling_stock_form.base_power_class = Some("".to_string());

        let request = rolling_stock_create_request(&fast_rolling_stock_form);

        // WHEN
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        // THEN
        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:BasePowerClassEmpty"
        );
    }

    #[rstest]
    async fn create_rolling_stock_with_invalid_effort_curve() {
        let app = TestAppBuilder::default_app();

        let invalid_payload = get_rolling_stock_with_invalid_effort_curves();

        let request = TestRequest::post()
            .uri("/rolling_stock")
            .set_payload(invalid_payload)
            .insert_header(ContentType::json())
            .to_request();

        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(response.error_type, "editoast:JsonError");
        assert_eq!(
            response.message,
            r#"Json deserialize error: effort curve invalid, max_efforts and speeds arrays should have the same length at line 50 column 17"#
        );
    }

    #[rstest]
    async fn get_rolling_stock_by_id() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        let request = rolling_stock_get_by_id_request(fast_rolling_stock.id);

        // WHEN
        let response: RollingStockModel =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        assert_eq!(response, fast_rolling_stock);
    }

    #[rstest]
    async fn get_rolling_stock_by_name() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        let request = TestRequest::get()
            .uri(format!("/rolling_stock/name/{rs_name}").as_str())
            .to_request();

        let response: RollingStockModel =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        assert_eq!(response, fast_rolling_stock);
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_by_id() {
        let app = TestAppBuilder::default_app();

        let request = rolling_stock_get_by_id_request(0);

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_by_name() {
        let app = TestAppBuilder::default_app();

        let request = TestRequest::get()
            .uri(format!("/rolling_stock/name/{}", "unexisting_rolling_stock_name").as_str())
            .to_request();

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn update_unlocked_rolling_stock() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";

        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        let mut rolling_stock_form: RollingStockForm = fast_rolling_stock.clone().into();
        let updated_rs_name = "updated_fast_rolling_stock_name";
        rolling_stock_form.name = updated_rs_name.to_string();

        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}", fast_rolling_stock.id).as_str())
            .set_json(&rolling_stock_form)
            .to_request();

        // WHEN
        app.fetch(request).assert_status(StatusCode::OK);

        // THEN

        let updated_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(db_pool.get_ok().deref_mut(), fast_rolling_stock.id)
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
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), first_rs_name).await;

        let second_rs_name = "second_fast_rolling_stock_name";
        let second_fast_rolling_stock =
            create_rolling_stock_with_energy_sources(db_pool.get_ok().deref_mut(), second_rs_name)
                .await;

        let second_fast_rolling_stock_form: RollingStockForm = second_fast_rolling_stock.into();

        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}", first_fast_rolling_stock.id).as_str())
            .set_json(second_fast_rolling_stock_form)
            .to_request();

        // WHEN
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        // THEN
        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:NameAlreadyUsed"
        );
    }

    #[rstest]
    async fn update_locked_rolling_stock_fails() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to create rolling stock");

        let second_rs_name = "second_fast_rolling_stock_name";
        let second_fast_rolling_stock_form = rolling_stock_with_energy_sources_form(second_rs_name);

        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str())
            .set_json(second_fast_rolling_stock_form)
            .to_request();

        // WHEN
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        // THEN
        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:RollingStockIsLocked"
        );
    }

    #[rstest]
    async fn patch_lock_rolling_stock_successfully() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        assert!(!fast_rolling_stock.locked);

        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}/locked", fast_rolling_stock.id).as_str())
            .set_json(json!({ "locked": true }))
            .to_request();

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let fast_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(db_pool.get_ok().deref_mut(), fast_rolling_stock.id)
                .await
                .expect("Failed to retrieve rolling stock")
                .expect("Rolling stock not found");

        assert_eq!(fast_rolling_stock.locked, true)
    }

    #[rstest]
    async fn patch_unlock_rolling_stock_successfully() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to create rolling stock");
        assert!(locked_fast_rolling_stock.locked);

        let request = TestRequest::patch()
            .uri(format!("/rolling_stock/{}/locked", locked_fast_rolling_stock.id).as_str())
            .set_json(json!({ "locked": false }))
            .to_request();

        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        let fast_rolling_stock: RollingStockModel =
            RollingStockModel::retrieve(db_pool.get_ok().deref_mut(), locked_fast_rolling_stock.id)
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
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;
        let power_restrictions = fast_rolling_stock.power_restrictions.clone();

        let request = TestRequest::get()
            .uri("/rolling_stock/power_restrictions")
            .to_request();

        // WHEN
        let response: Vec<String> = app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        let power_restrictions = serde_json::to_string(&power_restrictions)
            .expect("Failed to convert power_restrictions to string");
        assert!(power_restrictions.contains(&"C2".to_string()));
        assert!(power_restrictions.contains(&"C5".to_string()));
        assert!(response.contains(&"C2".to_string()));
        assert!(response.contains(&"C5".to_string()));
    }

    #[rstest]
    async fn delete_locked_rolling_stock_fails() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let locked_rs_name = "locked_fast_rolling_stock_name";
        let locked_fast_rolling_stock_changeset =
            fast_rolling_stock_changeset(locked_rs_name).locked(true);
        let locked_fast_rolling_stock = locked_fast_rolling_stock_changeset
            .create(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to create rolling stock");

        let request = TestRequest::delete()
            .uri(format!("/rolling_stock/{}", locked_fast_rolling_stock.id).as_str())
            .to_request();

        // WHEN
        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        // THEN
        assert_eq!(
            response.error_type,
            "editoast:rollingstocks:RollingStockIsLocked"
        );

        let rolling_stock_exists =
            RollingStockModel::exists(db_pool.get_ok().deref_mut(), locked_fast_rolling_stock.id)
                .await
                .expect("Failed to check if rolling stock exists");

        assert_eq!(rolling_stock_exists, true);
    }

    #[rstest]
    async fn delete_unexisting_rolling_stock_returns_not_found() {
        let app = TestAppBuilder::default_app();
        let delete_request = rolling_stock_delete_request(0);
        app.fetch(delete_request)
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn delete_used_rolling_stock_should_fail() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let test_name = "delete_used_rolling_stock_should_fail";
        let project = create_project(db_pool.get_ok().deref_mut(), test_name).await;
        let study = create_study(db_pool.get_ok().deref_mut(), test_name, project.id).await;
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let timetable = create_timetable_v1(db_pool.get_ok().deref_mut(), test_name).await;
        let scenario = create_scenario_v1(
            db_pool.get_ok().deref_mut(),
            test_name,
            study.id,
            timetable.get_id(),
            infra.id,
        )
        .await;
        let rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), test_name).await;
        let pathfinding = create_pathfinding(db_pool.get_ok().deref_mut(), infra.id).await;
        let train_schedule = create_train_schedule_v1(
            db_pool.get_ok().deref_mut(),
            pathfinding.id,
            timetable.get_id(),
            rolling_stock.id,
        )
        .await;

        // WHEN
        let response: InternalError = app
            .fetch(rolling_stock_delete_request(rolling_stock.id))
            .assert_status(StatusCode::CONFLICT)
            .json_into();

        // THEN
        let expected_usage = vec![TrainScheduleScenarioStudyProject {
            train_schedule_id: train_schedule.id.unwrap(),
            train_name: train_schedule.train_name.clone(),
            scenario_id: scenario.id.unwrap(),
            scenario_name: scenario.name.clone().unwrap(),
            study_id: study.id,
            study_name: study.name.clone(),
            project_id: project.id,
            project_name: project.name.clone(),
        }];
        let expected_error: InternalError = RollingStockError::RollingStockIsUsed {
            rolling_stock_id: rolling_stock.id,
            usage: expected_usage,
        }
        .into();
        assert_eq!(response, expected_error);
    }

    #[rstest]
    async fn forcefully_delete_used_rolling_stock() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let test_name = "forcefully_delete_used_rolling_stock";
        let rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), test_name).await;

        // WHEN
        let request = TestRequest::delete()
            .uri(format!("/rolling_stock/{}?force=true", rolling_stock.id).as_str())
            .to_request();

        // THEN
        app.fetch(request).assert_status(StatusCode::NO_CONTENT);
    }
}
