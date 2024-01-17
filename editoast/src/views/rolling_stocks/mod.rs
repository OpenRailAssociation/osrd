use crate::error::Result;
use crate::models::{
    rolling_stock::RollingStockSeparatedImageModel, Create, Delete, Retrieve,
    RollingStockLiveryModel, RollingStockModel, Update,
};
use crate::modelsv2::{Document, Model};
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock::{
    RollingStock, RollingStockCommon, RollingStockMetadata, RollingStockWithLiveries,
    ROLLING_STOCK_RAILJSON_VERSION,
};
use crate::DbPool;
use actix_multipart::form::text::Text;
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use diesel::{
    sql_query,
    sql_types::{BigInt, Text as SqlText},
};
use diesel_async::RunQueryDsl;
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use image::io::Reader as ImageReader;
use image::{DynamicImage, GenericImage, ImageBuffer, ImageOutputFormat};

use serde_derive::{Deserialize, Serialize};
use std::io::{BufReader, Cursor, Read};
use thiserror::Error;
use validator::Validate;

use actix_multipart::form::{tempfile::TempFile, MultipartForm};

use utoipa::{IntoParams, ToSchema};

crate::routes! {
    "/rolling_stock" => {
        create,
        "/power_restrictions" => {
            get_power_restrictions,
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

crate::schemas! {
    RollingStockForm,
    DeleteRollingStockQueryParams,
    RollingStockLockedUpdateForm,
    RollingStockLiveryCreateForm,
    PowerRestriction,
    RollingStockError,
    TrainScheduleScenarioStudyProject,
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
    #[error("Rolling stock '{rolling_stock_id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { rolling_stock_id: i64 },
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

#[derive(IntoParams)]
#[allow(unused)]
pub struct RollingStockIdParam {
    rolling_stock_id: i64,
}

/// Get a rolling stock by Id
#[utoipa::path(
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 201, body = RollingStockWithLiveries, description = "The requested rolling stock"),
    )
)]
#[get("")]
async fn get(db_pool: Data<DbPool>, path: Path<i64>) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock_id = path.into_inner();
    let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id).await?;
    let rolling_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rolling_stock_with_liveries))
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct RollingStockForm {
    #[serde(flatten)]
    pub common: RollingStockCommon,
    pub locked: Option<bool>,
    pub metadata: RollingStockMetadata,
}

impl From<RollingStockForm> for RollingStockModel {
    fn from(rolling_stock: RollingStockForm) -> Self {
        RollingStockModel {
            railjson_version: Some(ROLLING_STOCK_RAILJSON_VERSION.to_string()),
            locked: rolling_stock.locked,
            metadata: Some(DieselJson(rolling_stock.metadata)),
            name: Some(rolling_stock.common.name),
            effort_curves: Some(DieselJson(rolling_stock.common.effort_curves)),
            base_power_class: Some(rolling_stock.common.base_power_class),
            length: Some(rolling_stock.common.length),
            max_speed: Some(rolling_stock.common.max_speed),
            startup_time: Some(rolling_stock.common.startup_time),
            startup_acceleration: Some(rolling_stock.common.startup_acceleration),
            comfort_acceleration: Some(rolling_stock.common.comfort_acceleration),
            gamma: Some(DieselJson(rolling_stock.common.gamma)),
            inertia_coefficient: Some(rolling_stock.common.inertia_coefficient),
            features: Some(rolling_stock.common.features),
            mass: Some(rolling_stock.common.mass),
            rolling_resistance: Some(DieselJson(rolling_stock.common.rolling_resistance)),
            loading_gauge: Some(rolling_stock.common.loading_gauge),
            power_restrictions: Some(rolling_stock.common.power_restrictions),
            energy_sources: Some(DieselJson(rolling_stock.common.energy_sources)),
            electrical_power_startup_time: Some(rolling_stock.common.electrical_power_startup_time),
            raise_pantograph_time: Some(rolling_stock.common.raise_pantograph_time),
            supported_signaling_systems: Some(DieselJson(
                rolling_stock.common.supported_signaling_systems,
            )),
            ..Default::default()
        }
    }
}

impl RollingStockForm {
    fn into_rolling_stock_model(
        self,
        rolling_stock_id: i64,
        rollingstock_version: Option<i64>,
    ) -> RollingStockModel {
        RollingStockModel {
            id: Some(rolling_stock_id),
            version: rollingstock_version,
            ..self.into()
        }
    }
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, ToSchema)]
struct PowerRestriction {
    #[diesel(sql_type = SqlText)]
    power_restriction: String,
}

/// Returns the set of power restrictions for all rolling_stocks modes.
#[utoipa::path(tag = "rolling_stock",
    responses(
        (status = 200, description = "Retrieve the power restrictions list", body = Vec<String>)
    )
)]
#[get("")]
async fn get_power_restrictions(db_pool: Data<DbPool>) -> Result<Json<Vec<String>>> {
    let mut conn = db_pool.get().await?;
    let power_restrictions: Vec<PowerRestriction> = sql_query(
        "SELECT DISTINCT jsonb_object_keys(power_restrictions) AS power_restriction
        FROM rolling_stock",
    )
    .load(&mut conn)
    .await?;
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
    db_pool: Data<DbPool>,
    data: Json<RollingStockForm>,
    query_params: Query<PostRollingStockQueryParams>,
) -> Result<Json<RollingStock>> {
    let mut rolling_stock: RollingStockModel = data.into_inner().into();
    rolling_stock.validate()?;
    rolling_stock.locked = Some(query_params.locked);
    rolling_stock.version = Some(0);
    let rolling_stock: RollingStock = rolling_stock.create(db_pool).await?.into();

    Ok(Json(rolling_stock))
}

/// Patch a rolling stock
#[utoipa::path(tag = "rolling_stock",
    params(RollingStockIdParam),
    request_body = RollingStockForm,
    responses(
        (status = 200, description = "The created rolling stock", body = RollingStock)
    )
)]
#[patch("")]
async fn update(
    db_pool: Data<DbPool>,
    path: Path<i64>,
    data: Json<RollingStockForm>,
) -> Result<Json<RollingStockWithLiveries>> {
    let data = data.into_inner();
    let rolling_stock_id = path.into_inner();
    let existing_rolling_stock =
        retrieve_existing_rolling_stock(&db_pool, rolling_stock_id).await?;
    assert_rolling_stock_unlocked(existing_rolling_stock.clone())?;
    let version = existing_rolling_stock.version;

    let mut rolling_stock = data.into_rolling_stock_model(rolling_stock_id, version);
    rolling_stock.validate()?;
    if existing_rolling_stock != rolling_stock {
        rolling_stock.version = version.map(|v| v + 1);
    };

    let rolling_stock = rolling_stock
        .update(db_pool.clone(), rolling_stock_id)
        .await?;
    if let Some(rolling_stock) = rolling_stock {
        let rolling_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
        Ok(Json(rolling_stock_with_liveries))
    } else {
        Err(RollingStockError::NotFound { rolling_stock_id }.into())
    }
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
    db_pool: Data<DbPool>,
    path: Path<i64>,
    params: Query<DeleteRollingStockQueryParams>,
) -> Result<HttpResponse> {
    let rolling_stock_id = path.into_inner();
    assert_rolling_stock_unlocked(
        retrieve_existing_rolling_stock(&db_pool, rolling_stock_id).await?,
    )?;

    if params.force {
        return delete_rolling_stock(db_pool.clone(), rolling_stock_id).await;
    }

    let trains = get_rolling_stock_usage(db_pool.clone(), rolling_stock_id).await?;
    if trains.is_empty() {
        return delete_rolling_stock(db_pool.clone(), rolling_stock_id).await;
    }
    Err(RollingStockError::RollingStockIsUsed {
        rolling_stock_id,
        usage: trains,
    }
    .into())
}

async fn delete_rolling_stock(
    db_pool: Data<DbPool>,
    rolling_stock_id: i64,
) -> Result<HttpResponse> {
    match RollingStockModel::delete(db_pool.clone(), rolling_stock_id).await {
        Ok(false) => Err(RollingStockError::NotFound { rolling_stock_id }.into()),
        Ok(true) => Ok(HttpResponse::NoContent().finish()),
        Err(err) => Err(err),
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct RollingStockLockedUpdateForm {
    /// New locked value
    pub locked: bool,
}

impl RollingStockLockedUpdateForm {
    fn into_rolling_stock_model(self, rolling_stock_id: i64) -> RollingStockModel {
        RollingStockModel {
            id: Some(rolling_stock_id),
            locked: Some(self.locked),
            ..Default::default()
        }
    }
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
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
    data: Json<RollingStockLockedUpdateForm>,
) -> Result<HttpResponse> {
    let data = data.into_inner();
    let rolling_stock_id = rolling_stock_id.into_inner();
    let rolling_stock = data.into_rolling_stock_model(rolling_stock_id);

    rolling_stock
        .update(db_pool.clone(), rolling_stock_id)
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

#[derive(Debug, QueryableByName, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainScheduleScenarioStudyProject {
    #[diesel(sql_type = BigInt)]
    pub train_schedule_id: i64,
    #[diesel(sql_type = SqlText)]
    pub train_name: String,
    #[diesel(sql_type = BigInt)]
    pub project_id: i64,
    #[diesel(sql_type = SqlText)]
    pub project_name: String,
    #[diesel(sql_type = BigInt)]
    pub study_id: i64,
    #[diesel(sql_type = SqlText)]
    pub study_name: String,
    #[diesel(sql_type = BigInt)]
    pub scenario_id: i64,
    #[diesel(sql_type = SqlText)]
    pub scenario_name: String,
}

async fn get_rolling_stock_usage(
    db_pool: Data<DbPool>,
    rolling_stock_id: i64,
) -> Result<Vec<TrainScheduleScenarioStudyProject>> {
    let mut conn = db_pool.get().await?;
    let _stock = RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
        .await?
        .ok_or(RollingStockError::NotFound { rolling_stock_id })?;

    sql_query(include_str!("sql/get_train_schedules_with_scenario.sql"))
        .bind::<BigInt, _>(rolling_stock_id)
        .load(&mut conn)
        .await
        .map_err(|e| e.into())
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
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
    MultipartForm(form): MultipartForm<RollingStockLiveryCreateForm>,
) -> Result<Json<RollingStockLivery>> {
    let rolling_stock_id = rolling_stock_id.into_inner();

    let formatted_images = format_images(form.images)?;

    // create compound image
    let compound_image = create_compound_image(db_pool.clone(), formatted_images.clone()).await?;

    // create livery
    let rolling_stock_livery = RollingStockLiveryModel {
        name: Some(form.name.into_inner()),
        rolling_stock_id: Some(rolling_stock_id),
        compound_image_id: Some(Some(compound_image.id)),
        ..Default::default()
    };
    let rolling_stock_livery: RollingStockLivery =
        rolling_stock_livery.create(db_pool.clone()).await?.into();

    // create separated images
    let FormattedImages { images, .. } = formatted_images;
    for (index, image) in images.into_iter().enumerate() {
        let mut w = Cursor::new(Vec::new());
        image.write_to(&mut w, ImageOutputFormat::Png).unwrap();

        use crate::modelsv2::Create;
        let conn = &mut db_pool.get().await?;
        let image = Document::changeset()
            .content_type(String::from("image/png"))
            .data(w.into_inner())
            .create(conn)
            .await?;

        let _ = RollingStockSeparatedImageModel {
            image_id: Some(image.id),
            livery_id: Some(rolling_stock_livery.id),
            order: Some(index.try_into().unwrap()),
            ..Default::default()
        }
        .create(db_pool.clone())
        .await?;
    }

    Ok(Json(rolling_stock_livery))
}

pub async fn retrieve_existing_rolling_stock(
    db_pool: &Data<DbPool>,
    rolling_stock_id: i64,
) -> Result<RollingStockModel> {
    RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
        .await?
        .ok_or(RollingStockError::NotFound { rolling_stock_id }.into())
}

fn assert_rolling_stock_unlocked(rolling_stock: RollingStockModel) -> Result<()> {
    if rolling_stock.locked.unwrap() {
        return Err(RollingStockError::RollingStockIsLocked {
            rolling_stock_id: rolling_stock.id.unwrap(),
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
    db_pool: Data<DbPool>,
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
        .write_to(&mut w, ImageOutputFormat::Png)
        .unwrap();

    // save the compound_image in the db
    use crate::modelsv2::Create;
    let conn = &mut db_pool.get().await?;
    let compound_image = Document::changeset()
        .content_type(String::from("image/png"))
        .data(w.into_inner())
        .create(conn)
        .await?;
    Ok(compound_image)
}

#[cfg(test)]
pub mod tests {
    use std::vec;

    use super::RollingStockError;
    use super::{retrieve_existing_rolling_stock, RollingStock, TrainScheduleScenarioStudyProject};
    use crate::fixtures::tests::{
        db_pool, get_fast_rolling_stock, get_other_rolling_stock, named_fast_rolling_stock,
        named_other_rolling_stock, train_schedule_with_scenario,
    };
    use crate::models::rolling_stock::tests::get_invalid_effort_curves;
    use crate::models::{Delete, RollingStockModel};
    use crate::views::tests::create_test_service;
    use crate::{assert_response_error_type_match, assert_status_and_read, DbPool};
    use actix_http::{Request, StatusCode};
    use actix_web::dev::ServiceResponse;
    use actix_web::http::header::ContentType;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use actix_web::web::Data;
    use rstest::rstest;
    use serde_json::json;

    #[rstest]
    async fn get_returns_corresponding_rolling_stock(db_pool: Data<DbPool>) {
        // GIVEN
        let name = "fast_rolling_stock_get_returns_corresponding_rolling_stock";
        let app = create_test_service().await;
        let rolling_stock = named_fast_rolling_stock(name, db_pool).await;
        let req = rolling_stock_get_request(rolling_stock.id());

        // WHEN
        let response = call_service(&app, req).await;

        // THEN
        let response_body: RollingStock = assert_status_and_read!(response, StatusCode::OK);
        assert_eq!(response_body.common.name, name);
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_returns_not_found() {
        let app = create_test_service().await;
        let get_request = rolling_stock_get_request(0);
        let get_response = call_service(&app, get_request).await;

        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn create_and_delete_unlocked_rolling_stock_successfully() {
        // GIVEN
        let app = create_test_service().await;
        let mut rolling_stock: RollingStockModel = get_fast_rolling_stock(
            "fast_rolling_stock_create_and_delete_unlocked_rolling_stock_successfully",
        );

        // WHEN
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        // Check rolling_stock creation
        let response_body: RollingStock = assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id: i64 = response_body.id;
        rolling_stock.id = Some(response_body.id);
        let expected_body = RollingStock::from(rolling_stock.clone());
        assert_eq!(response_body, expected_body);

        // Check rolling_stock deletion
        let delete_request = rolling_stock_delete_request(rolling_stock_id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

        // Check rolling_stock does not exist anymore
        let get_request = rolling_stock_get_request(rolling_stock_id);
        let get_response = call_service(&app, get_request).await;
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    async fn check_create_gave_400(db_pool: Data<DbPool>, response: ServiceResponse) {
        if response.status() == StatusCode::OK {
            let rolling_stock: RollingStock = read_body_json(response).await;
            let rolling_stock_id = rolling_stock.id;
            RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
                .await
                .unwrap();
            panic!("Rolling stock created but should not have been");
        } else {
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "Here is the full response body {:?}",
                response.into_body()
            );
        }
    }

    #[rstest]
    async fn create_rolling_stock_with_base_power_class_empty(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let mut rolling_stock: RollingStockModel = get_fast_rolling_stock(
            "fast_rolling_stock_create_rolling_stock_with_base_power_class_empty",
        );

        rolling_stock.base_power_class = Some(Some("".to_string()));

        // WHEN
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        check_create_gave_400(db_pool, post_response).await;
    }

    #[rstest]
    async fn create_rolling_stock_with_duplicate_name(db_pool: Data<DbPool>) {
        // GIVEN
        let name = "fast_rolling_stock_create_rolling_stock_with_duplicate_name";
        let fast_rolling_stock = named_fast_rolling_stock(name, db_pool.clone()).await;
        let app = create_test_service().await;
        let mut rolling_stock: RollingStockModel = get_fast_rolling_stock(name);

        rolling_stock.name = fast_rolling_stock.model.name.clone();

        // WHEN
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        check_create_gave_400(db_pool, post_response).await;
    }

    #[rstest]
    async fn update_and_delete_locked_rolling_stock_fails(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let rolling_stock: RollingStockModel = get_fast_rolling_stock(
            "fast_rolling_stock_update_and_delete_locked_rolling_stock_fails",
        );

        // WHEN
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock?locked=true")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        let locked_rolling_stock: RollingStock =
            assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id = locked_rolling_stock.id;

        // Check rolling_stock update fails
        let patch_response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(locked_rolling_stock)
                .to_request(),
        )
        .await;
        assert_eq!(patch_response.status(), StatusCode::BAD_REQUEST);
        assert_response_error_type_match!(
            patch_response,
            RollingStockError::RollingStockIsLocked { rolling_stock_id }
        );

        // Check rolling_stock deletion fails
        let delete_request = rolling_stock_delete_request(rolling_stock_id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::BAD_REQUEST);
        assert_response_error_type_match!(
            delete_response,
            RollingStockError::RollingStockIsLocked { rolling_stock_id }
        );

        // Check rolling_stock still exists
        let get_request = rolling_stock_get_request(rolling_stock_id);
        let get_response = call_service(&app, get_request).await;
        assert_eq!(get_response.status(), StatusCode::OK);

        // Delete rolling_stock to clean db
        let _ = RollingStockModel::delete(db_pool, rolling_stock_id).await;
    }

    #[rstest]
    async fn delete_unexisting_rolling_stock_returns_not_found() {
        let app = create_test_service().await;
        let delete_request = rolling_stock_delete_request(0);
        let delete_response = call_service(&app, delete_request).await;

        assert_eq!(delete_response.status(), StatusCode::NOT_FOUND);
    }

    fn rolling_stock_get_request(rolling_stock_id: i64) -> Request {
        TestRequest::get()
            .uri(format!("/rolling_stock/{rolling_stock_id}").as_str())
            .to_request()
    }

    pub fn rolling_stock_delete_request(rolling_stock_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/rolling_stock/{rolling_stock_id}").as_str())
            .to_request()
    }

    fn rolling_stock_locked_request(rolling_stock_id: i64, locked: bool) -> Request {
        TestRequest::patch()
            .uri(format!("/rolling_stock/{rolling_stock_id}/locked").as_str())
            .set_json(json!({ "locked": locked }))
            .to_request()
    }

    #[rstest]
    async fn create_rolling_stock_failure_invalid_effort_curve() {
        let app = create_test_service().await;

        let invalid_payload = get_invalid_effort_curves();

        let response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_payload(invalid_payload)
                .insert_header(ContentType::json())
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn update_unlocked_rolling_stock(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let fast_rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_update_unlocked_rolling_stock",
            db_pool.clone(),
        )
        .await;
        let rolling_stock_id = fast_rolling_stock.id();

        let mut rolling_stock =
            get_other_rolling_stock("other_rolling_stock_update_unlocked_rolling_stock");
        rolling_stock.id = Some(rolling_stock_id);

        // WHEN
        let response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        let response_body: RollingStock = assert_status_and_read!(response, StatusCode::OK);

        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();

        // Assert rolling_stock version is 1
        assert_eq!(rolling_stock.version.unwrap(), 1);

        let expected_body = RollingStock::from(rolling_stock);
        assert_eq!(response_body, expected_body);
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used(db_pool: Data<DbPool>) {
        // GIVEN
        let other_rs_name = "other_rolling_stock_update_rolling_stock_failure_name_already_used";
        let app = create_test_service().await;
        let fast_rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_update_rolling_stock_failure_name_already_used",
            db_pool.clone(),
        )
        .await;
        let _other_rs = named_other_rolling_stock(other_rs_name, db_pool).await;

        let rolling_stock_id = fast_rolling_stock.id();

        let mut rolling_stock = get_other_rolling_stock(other_rs_name);
        rolling_stock.id = Some(rolling_stock_id);

        // WHEN
        let response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_response_error_type_match!(
            response,
            RollingStockError::NameAlreadyUsed {
                name: String::from(other_rs_name),
            }
        );
    }

    #[rstest]
    async fn update_locked_successfully(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let rolling_stock = get_fast_rolling_stock("fast_rolling_stock_update_locked_successfully");

        // WHEN
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;

        // THEN
        let response_body: RollingStock = assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id = response_body.id;
        assert!(!response_body.locked);

        // Lock rolling_stock
        let request = rolling_stock_locked_request(rolling_stock_id, true);
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        // Assert rolling_stock is locked
        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();
        assert!(rolling_stock.locked.unwrap());

        // Unlock rolling_stock
        let request = rolling_stock_locked_request(rolling_stock_id, false);
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        // Assert rolling_stock is unlocked
        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();
        assert!(!rolling_stock.locked.unwrap());

        // Delete rolling_stock
        call_service(&app, rolling_stock_delete_request(rolling_stock_id)).await;
    }

    #[rstest]
    async fn delete_used_rolling_stock_should_fail() {
        // GIVEN
        let app = create_test_service().await;
        let train_schedule_with_scenario =
            train_schedule_with_scenario("delete_used_rolling_stock_should_fail").await;
        let rolling_stock_id = train_schedule_with_scenario.rolling_stock.id();

        // WHEN
        let response = call_service(&app, rolling_stock_delete_request(rolling_stock_id)).await;

        // THEN
        assert_eq!(response.status(), StatusCode::CONFLICT);
        let expected_usage = vec![TrainScheduleScenarioStudyProject {
            train_schedule_id: train_schedule_with_scenario.train_schedule.id(),
            train_name: train_schedule_with_scenario
                .train_schedule
                .model
                .train_name
                .clone(),
            scenario_id: train_schedule_with_scenario.scenario.id(),
            scenario_name: train_schedule_with_scenario
                .scenario
                .model
                .name
                .clone()
                .unwrap(),
            study_id: train_schedule_with_scenario.study.id(),
            study_name: train_schedule_with_scenario
                .study
                .model
                .name
                .clone()
                .unwrap(),
            project_id: train_schedule_with_scenario.project.id(),
            project_name: train_schedule_with_scenario
                .project
                .model
                .name
                .clone()
                .unwrap(),
        }];
        assert_response_error_type_match!(
            response,
            RollingStockError::RollingStockIsUsed {
                rolling_stock_id,
                usage: expected_usage
            }
        )
    }

    #[rstest]
    async fn forcefully_delete_used_rolling_stock() {
        // GIVEN
        let app = create_test_service().await;
        let train_schedule_with_scenario =
            train_schedule_with_scenario("forcefully_delete_used_rolling_stock").await;
        let rolling_stock_id = train_schedule_with_scenario.rolling_stock.id();

        // WHEN
        let response = call_service(
            &app,
            TestRequest::delete()
                .uri(format!("/rolling_stock/{}?force=true", rolling_stock_id).as_str())
                .to_request(),
        )
        .await;

        // THEN
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn get_power_restrictions_list(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let rolling_stock =
            named_fast_rolling_stock("fast_rolling_stock_get_power_restrictions_list", db_pool)
                .await;
        let power_restrictions = rolling_stock.model.power_restrictions.clone().unwrap();

        // WHEN
        let response = call_service(
            &app,
            TestRequest::get()
                .uri("/rolling_stock/power_restrictions")
                .to_request(),
        )
        .await;

        // THEN
        let power_restrictions = serde_json::to_string(&power_restrictions)
            .expect("Failed to convert power_restrictions to string");
        assert!(power_restrictions.contains(&"C2".to_string()));
        assert!(power_restrictions.contains(&"C5".to_string()));
        let response_body: Vec<String> = read_body_json(response).await;
        assert!(response_body.contains(&"C2".to_string()));
        assert!(response_body.contains(&"C5".to_string()));
    }
}
