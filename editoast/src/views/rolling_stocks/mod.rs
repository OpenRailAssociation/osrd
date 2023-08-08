use crate::error::Result;
use crate::models::rolling_stock::RollingStockSeparatedImageModel;
use crate::models::{
    Create, Delete, Document, Retrieve, RollingStockLiveryModel, RollingStockModel, Update,
};
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock::{
    RollingStock, RollingStockCommon, RollingStockMetadata, RollingStockWithLiveries,
    ROLLING_STOCK_RAILJSON_VERSION,
};
use crate::DbPool;
use actix_multipart::form::text::Text;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, scope, Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use diesel::{
    sql_query,
    sql_types::{BigInt, Text as SqlText},
    RunQueryDsl,
};
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use image::io::Reader as ImageReader;
use image::{DynamicImage, GenericImage, ImageBuffer, ImageOutputFormat};

use serde_derive::{Deserialize, Serialize};
use std::io::{BufReader, Cursor, Read};
use thiserror::Error;

use actix_multipart::form::{tempfile::TempFile, MultipartForm};

#[derive(Debug, Error, EditoastError)]
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
}

pub fn routes() -> impl HttpServiceFactory {
    scope("/rolling_stock")
        .service((get, create, update, delete))
        .service(scope("/{rolling_stock_id}").service((
            create_livery,
            update_locked,
            check_rolling_stock_usage,
        )))
}

#[get("/{rolling_stock_id}")]
async fn get(db_pool: Data<DbPool>, path: Path<i64>) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock_id = path.into_inner();
    let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id).await?;
    let rolling_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rolling_stock_with_liveries))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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

#[derive(Debug, Deserialize)]
struct PostQueryParams {
    #[serde(default)]
    locked: bool,
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<RollingStockForm>,
    query_params: Query<PostQueryParams>,
) -> Result<Json<RollingStock>> {
    let mut rolling_stock: RollingStockModel = data.into_inner().into();
    rolling_stock.locked = Some(query_params.locked);
    rolling_stock.version = Some(0);
    let rolling_stock: RollingStock = rolling_stock.create(db_pool).await?.into();

    Ok(Json(rolling_stock))
}

#[patch("/{rolling_stock_id}")]
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
    if existing_rolling_stock != rolling_stock {
        rolling_stock.version = version.map(|v| v + 1);
    };

    let rolling_stock = rolling_stock
        .update(db_pool.clone(), rolling_stock_id)
        .await?
        .unwrap();
    let rolling_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rolling_stock_with_liveries))
}

#[derive(Deserialize)]
struct DeleteQueryParams {
    #[serde(default)]
    force: bool,
}

#[delete("/{rolling_stock_id}")]
async fn delete(
    db_pool: Data<DbPool>,
    path: Path<i64>,
    params: Query<DeleteQueryParams>,
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

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RollingStockLockedUpdateForm {
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

#[patch("/locked")]
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

#[derive(Debug, MultipartForm)]
struct RollingStockLiveryCreateForm {
    pub name: Text<String>,
    pub images: Vec<TempFile>,
}

#[derive(Debug, QueryableByName, Serialize, Deserialize, PartialEq)]
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

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct UsageResponse {
    usage: Vec<TrainScheduleScenarioStudyProject>,
}

#[get("/check_usage")]
async fn check_rolling_stock_usage(
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
) -> Result<Json<UsageResponse>> {
    let rolling_stock_id = rolling_stock_id.into_inner();
    get_rolling_stock_usage(db_pool, rolling_stock_id)
        .await
        .map(|trains| Json(UsageResponse { usage: trains }))
}

async fn get_rolling_stock_usage(
    db_pool: Data<DbPool>,
    rolling_stock_id: i64,
) -> Result<Vec<TrainScheduleScenarioStudyProject>> {
    match RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id).await {
        Ok(Some(_)) => block(move || {
            let mut conn = db_pool.get()?;
            let trains = sql_query(include_str!("sql/get_train_schedules_with_scenario.sql"))
                .bind::<BigInt, _>(rolling_stock_id)
                .load(&mut conn)?;
            Ok(trains)
        })
        .await
        .unwrap(),
        Ok(None) => Err(RollingStockError::NotFound { rolling_stock_id }.into()),
        Err(err) => Err(err),
    }
}

#[post("/livery")]
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
        compound_image_id: Some(compound_image.id),
        ..Default::default()
    };
    let rolling_stock_livery: RollingStockLivery =
        rolling_stock_livery.create(db_pool.clone()).await?.into();

    // create separated images
    let FormattedImages { images, .. } = formatted_images;
    for (index, image) in images.into_iter().enumerate() {
        let mut w = Cursor::new(Vec::new());
        image.write_to(&mut w, ImageOutputFormat::Png).unwrap();

        let image = Document::new(String::from("image/png"), w.into_inner())
            .create(db_pool.clone())
            .await?;
        let _ = RollingStockSeparatedImageModel {
            image_id: Some(image.id.unwrap()),
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

#[derive(Clone, Debug)]
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
    let compound_image = Document::new(String::from("image/png"), w.into_inner())
        .create(db_pool.clone())
        .await?;
    Ok(compound_image)
}

#[cfg(test)]
pub mod tests {
    use std::vec;

    use super::RollingStockError;
    use super::{
        retrieve_existing_rolling_stock, RollingStock, TrainScheduleScenarioStudyProject,
        UsageResponse,
    };
    use crate::fixtures::tests::{
        db_pool, fast_rolling_stock, other_rolling_stock, train_schedule_with_scenario,
        TestFixture, TrainScheduleFixtureSet,
    };
    use crate::models::rolling_stock::tests::{
        get_fast_rolling_stock, get_invalid_effort_curves, get_other_rolling_stock,
    };
    use crate::models::{Delete, RollingStockModel};
    use crate::views::tests::create_test_service;
    use crate::{assert_editoast_error_type, assert_status_and_read};
    use actix_http::{Request, StatusCode};
    use actix_web::http::header::ContentType;
    use actix_web::test::{call_service, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::ConnectionManager;
    use r2d2::Pool;
    use rstest::rstest;
    use serde_json::json;

    #[rstest]
    async fn get_returns_corresponding_rolling_stock(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let app = create_test_service().await;
        let rolling_stock = fast_rolling_stock.await;
        let req = rolling_stock_get_request(rolling_stock.id());
        let response = call_service(&app, req).await;

        let response_body: RollingStock = assert_status_and_read!(response, StatusCode::OK);
        assert_eq!(response_body.common.name, "fast_rolling_stock");
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
        let app = create_test_service().await;
        let mut rolling_stock: RollingStockModel = get_fast_rolling_stock();

        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        //Check rolling_stock creation
        let response_body: RollingStock = assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id: i64 = response_body.id;
        rolling_stock.id = Some(response_body.id);
        let expected_body = RollingStock::from(rolling_stock.clone());
        assert_eq!(response_body, expected_body);

        //Check rolling_stock deletion
        let delete_request = rolling_stock_delete_request(rolling_stock_id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

        //Check rolling_stock does not exist anymore
        let get_request = rolling_stock_get_request(rolling_stock_id);
        let get_response = call_service(&app, get_request).await;
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn update_and_delete_locked_rolling_stock_fails(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) {
        let app = create_test_service().await;
        let rolling_stock: RollingStockModel = get_fast_rolling_stock();
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock?locked=true")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;
        let locked_rolling_stock: RollingStock =
            assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id = locked_rolling_stock.id;

        //Check rolling_stock update fails
        let patch_response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(locked_rolling_stock)
                .to_request(),
        )
        .await;
        assert_eq!(patch_response.status(), StatusCode::BAD_REQUEST);
        assert_editoast_error_type!(
            patch_response,
            RollingStockError::RollingStockIsLocked { rolling_stock_id }
        );

        //Check rolling_stock deletion fails
        let delete_request = rolling_stock_delete_request(rolling_stock_id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::BAD_REQUEST);
        assert_editoast_error_type!(
            delete_response,
            RollingStockError::RollingStockIsLocked { rolling_stock_id }
        );

        //Check rolling_stock still exists
        let get_request = rolling_stock_get_request(rolling_stock_id);
        let get_response = call_service(&app, get_request).await;
        assert_eq!(get_response.status(), StatusCode::OK);

        //Delete rolling_stock to clean db
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
    async fn update_unlocked_rolling_stock(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) {
        let app = create_test_service().await;
        let fast_rolling_stock = fast_rolling_stock.await;
        let rolling_stock_id = fast_rolling_stock.id();

        let mut rolling_stock = get_other_rolling_stock();
        rolling_stock.id = Some(rolling_stock_id);

        let response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(&rolling_stock)
                .to_request(),
        )
        .await;

        let response_body: RollingStock = assert_status_and_read!(response, StatusCode::OK);

        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();

        //Assert rolling_stock version is 1
        assert_eq!(rolling_stock.version.unwrap(), 1);

        let expected_body = RollingStock::from(rolling_stock);
        assert_eq!(response_body, expected_body);
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
        #[future] other_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let app = create_test_service().await;
        let fast_rolling_stock = fast_rolling_stock.await;
        let _other_rolling_stock = other_rolling_stock.await;
        let rolling_stock_id = fast_rolling_stock.id();

        let mut rolling_stock = get_other_rolling_stock();
        rolling_stock.id = Some(rolling_stock_id);

        let response = call_service(
            &app,
            TestRequest::patch()
                .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_editoast_error_type!(
            response,
            RollingStockError::NameAlreadyUsed {
                name: String::from("other_rolling_stock"),
            }
        );
    }

    #[rstest]
    async fn update_locked_successfully(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
    ) {
        let app = create_test_service().await;
        let rolling_stock = get_fast_rolling_stock();
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;
        let response_body: RollingStock = assert_status_and_read!(post_response, StatusCode::OK);
        let rolling_stock_id = response_body.id;
        assert!(!response_body.locked);

        //Lock rolling_stock
        let request = rolling_stock_locked_request(rolling_stock_id, true);
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        //Assert rolling_stock is locked
        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();
        assert!(rolling_stock.locked.unwrap());

        //Unlock rolling_stock
        let request = rolling_stock_locked_request(rolling_stock_id, false);
        let response = call_service(&app, request).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        //Assert rolling_stock is unlocked
        let rolling_stock = retrieve_existing_rolling_stock(&db_pool, rolling_stock_id)
            .await
            .unwrap();
        assert!(!rolling_stock.locked.unwrap());

        //Delete rolling_stock
        call_service(&app, rolling_stock_delete_request(rolling_stock_id)).await;
    }

    #[rstest]
    async fn check_usage_rolling_stock_not_found() {
        let app = create_test_service().await;
        let rolling_stock_id = 314159;
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(format!("/rolling_stock/{}/check_usage", rolling_stock_id).as_str())
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_editoast_error_type!(response, RollingStockError::NotFound { rolling_stock_id });
    }

    #[rstest]
    async fn check_usage_no_train_schedule_for_this_rolling_stock(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let rolling_stock = fast_rolling_stock.await;
        let app = create_test_service().await;
        let rolling_stock_id = rolling_stock.id();
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(format!("/rolling_stock/{}/check_usage", rolling_stock_id).as_str())
                .to_request(),
        )
        .await;
        let response_body: UsageResponse = assert_status_and_read!(response, StatusCode::OK);
        let expected_body = UsageResponse { usage: Vec::new() };
        assert_eq!(response_body, expected_body);
    }

    /// Tests`/rolling_stock/{rolling_stock_id}/check_usage` endpoint.
    /// Initial conditions: one `TrainSchedule` using the given `rolling_stock_id`.
    /// It should return the `TrainSchedule`, `project`/`study`/`scenario` ids/names
    #[rstest]
    async fn check_usage_one_train_schedule(
        #[future] train_schedule_with_scenario: TrainScheduleFixtureSet,
    ) {
        let app = create_test_service().await;
        let train_schedule_with_scenario = train_schedule_with_scenario.await;
        let rolling_stock_id = train_schedule_with_scenario.rolling_stock.id();
        let response = call_service(
            &app,
            TestRequest::get()
                .uri(format!("/rolling_stock/{}/check_usage", rolling_stock_id).as_str())
                .to_request(),
        )
        .await;

        let response_body: UsageResponse = assert_status_and_read!(response, StatusCode::OK);
        let expected_body = UsageResponse {
            usage: vec![TrainScheduleScenarioStudyProject {
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
            }],
        };
        assert_eq!(response_body, expected_body);
    }

    #[rstest]
    async fn delete_used_rolling_stock_should_fail(
        #[future] train_schedule_with_scenario: TrainScheduleFixtureSet,
    ) {
        let app = create_test_service().await;
        let train_schedule_with_scenario = train_schedule_with_scenario.await;
        let rolling_stock_id = train_schedule_with_scenario.rolling_stock.id();
        let response = call_service(&app, rolling_stock_delete_request(rolling_stock_id)).await;

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

        assert_eq!(response.status(), StatusCode::CONFLICT);
        assert_editoast_error_type!(
            response,
            RollingStockError::RollingStockIsUsed {
                rolling_stock_id,
                usage: expected_usage
            }
        )
    }

    #[rstest]
    async fn forcefully_delete_used_rolling_stock(
        #[future] train_schedule_with_scenario: TrainScheduleFixtureSet,
    ) {
        let app = create_test_service().await;
        let train_schedule_with_scenario = train_schedule_with_scenario.await;
        let rolling_stock_id = train_schedule_with_scenario.rolling_stock.id();
        let response = call_service(
            &app,
            TestRequest::delete()
                .uri(format!("/rolling_stock/{}?force=true", rolling_stock_id).as_str())
                .to_request(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
