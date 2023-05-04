use crate::error::Result;
use crate::models::rolling_stock::RollingStockSeparatedImageModel;
use crate::models::{
    Create, Delete, Document, Retrieve, RollingStockLiveryModel, RollingStockModel, Update,
};
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock::{
    EffortCurves, Gamma, RollingResistance, RollingStock, RollingStockMetadata,
    RollingStockWithLiveries,
};
use crate::DbPool;
use actix_multipart::form::text::Text;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{scope, Data, Json, Path};
use actix_web::{delete, get, patch, post, HttpResponse};
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use image::io::Reader as ImageReader;
use image::{DynamicImage, GenericImage, ImageBuffer, ImageOutputFormat};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
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
}

pub fn routes() -> impl HttpServiceFactory {
    scope("/rolling_stock")
        .service((get, create, update, delete))
        .service(scope("/{rolling_stock_id}").service(create_livery))
}

#[get("/{rolling_stock_id}")]
async fn get(db_pool: Data<DbPool>, path: Path<i64>) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock_id = path.into_inner();
    let rolling_stock = match RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id).await?
    {
        Some(rolling_stock) => rolling_stock,
        None => return Err(RollingStockError::NotFound { rolling_stock_id }.into()),
    };
    let rolling_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rolling_stock_with_liveries))
}

#[derive(Deserialize, Serialize)]
struct RollingStockForm {
    pub name: String,
    pub version: String,
    pub effort_curves: EffortCurves,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: String,
    pub metadata: RollingStockMetadata,
    pub power_restrictions: Option<JsonValue>,
}

impl From<RollingStockForm> for RollingStockModel {
    fn from(rolling_stock: RollingStockForm) -> Self {
        RollingStockModel {
            name: Some(rolling_stock.name),
            version: Some(rolling_stock.version),
            effort_curves: Some(DieselJson(rolling_stock.effort_curves)),
            base_power_class: Some(rolling_stock.base_power_class),
            length: Some(rolling_stock.length),
            max_speed: Some(rolling_stock.max_speed),
            startup_time: Some(rolling_stock.startup_time),
            startup_acceleration: Some(rolling_stock.startup_acceleration),
            comfort_acceleration: Some(rolling_stock.comfort_acceleration),
            gamma: Some(DieselJson(rolling_stock.gamma)),
            inertia_coefficient: Some(rolling_stock.inertia_coefficient),
            features: Some(rolling_stock.features),
            mass: Some(rolling_stock.mass),
            rolling_resistance: Some(DieselJson(rolling_stock.rolling_resistance)),
            loading_gauge: Some(rolling_stock.loading_gauge),
            metadata: Some(DieselJson(rolling_stock.metadata)),
            power_restrictions: Some(rolling_stock.power_restrictions),
            ..Default::default()
        }
    }
}

impl RollingStockForm {
    fn into_rolling_stock_model(self, rolling_stock_id: i64) -> RollingStockModel {
        RollingStockModel {
            id: Some(rolling_stock_id),
            name: Some(self.name),
            version: Some(self.version),
            effort_curves: Some(DieselJson(self.effort_curves)),
            base_power_class: Some(self.base_power_class),
            length: Some(self.length),
            max_speed: Some(self.max_speed),
            startup_time: Some(self.startup_time),
            startup_acceleration: Some(self.startup_acceleration),
            comfort_acceleration: Some(self.comfort_acceleration),
            gamma: Some(DieselJson(self.gamma)),
            inertia_coefficient: Some(self.inertia_coefficient),
            features: Some(self.features),
            mass: Some(self.mass),
            rolling_resistance: Some(DieselJson(self.rolling_resistance)),
            loading_gauge: Some(self.loading_gauge),
            metadata: Some(DieselJson(self.metadata)),
            power_restrictions: Some(self.power_restrictions),
        }
    }
}

#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<RollingStockForm>) -> Result<Json<RollingStock>> {
    let rolling_stock: RollingStockModel = data.into_inner().into();
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
    let rolling_stock = data.into_rolling_stock_model(rolling_stock_id);

    let rolling_stock = rolling_stock
        .update(db_pool.clone(), rolling_stock_id)
        .await?
        .unwrap();
    let rollig_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rollig_stock_with_liveries))
}

#[derive(Debug, MultipartForm)]
struct RollingStockLiveryCreateForm {
    pub name: Text<String>,
    pub images: Vec<TempFile>,
}

#[delete("/{rolling_stock_id}")]
async fn delete(db_pool: Data<DbPool>, path: Path<i64>) -> Result<HttpResponse> {
    let rolling_stock_id = path.into_inner();
    if !RollingStockModel::delete(db_pool, rolling_stock_id).await? {
        return Err(RollingStockError::NotFound { rolling_stock_id }.into());
    }
    Ok(HttpResponse::NoContent().finish())
}

#[post("/livery")]
async fn create_livery(
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
    MultipartForm(form): MultipartForm<RollingStockLiveryCreateForm>,
) -> Result<Json<RollingStockLivery>> {
    let rolling_stock_id = rolling_stock_id.into_inner();
    let rolling_stock = RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id).await?;
    if rolling_stock.is_none() {
        return Err(RollingStockError::NotFound { rolling_stock_id }.into());
    }

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
mod tests {
    use super::RollingStockError;
    use crate::error::InternalError;
    use crate::fixtures::tests::{fast_rolling_stock, other_rolling_stock, TestFixture};
    use crate::models::rolling_stock::tests::{
        get_fast_rolling_stock, get_invalid_effort_curves, get_other_rolling_stock,
    };
    use crate::models::RollingStockModel;
    use crate::views::rolling_stocks::RollingStock;
    use crate::views::tests::create_test_service;
    use actix_http::{Request, StatusCode};
    use actix_web::http::header::ContentType;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::{to_value, Value as JsonValue};

    #[rstest]
    async fn get_returns_corresponding_rolling_stock(
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let app = create_test_service().await;
        let rolling_stock = fast_rolling_stock.await;

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock.id()).as_str())
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let rolling_stock: RollingStock = read_body_json(response).await;
        assert_eq!(rolling_stock.name, "fast_rolling_stock");
    }

    #[rstest]
    async fn get_unexisting_rolling_stock_returns_not_found() {
        let app = create_test_service().await;
        let get_request = rolling_stock_get_request(0);
        let get_response = call_service(&app, get_request).await;

        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn create_and_delete_rolling_stock_successfully() {
        let app = create_test_service().await;
        let rolling_stock: RollingStockModel = get_fast_rolling_stock();

        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;

        //Check rolling_stock creation
        assert_eq!(post_response.status(), StatusCode::OK);
        let rolling_stock: RollingStock = read_body_json(post_response).await;
        assert_eq!(rolling_stock.name, "fast_rolling_stock");

        //Check rolling_stock deletion
        let delete_request = rolling_stock_delete_request(rolling_stock.id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

        //Check object does not exist anymore
        let get_request = rolling_stock_get_request(0);
        let get_response = call_service(&app, get_request).await;
        assert_eq!(get_response.status(), StatusCode::NOT_FOUND);
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

    fn rolling_stock_delete_request(rolling_stock_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/rolling_stock/{rolling_stock_id}").as_str())
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
    async fn update_rolling_stock(#[future] fast_rolling_stock: TestFixture<RollingStockModel>) {
        let app = create_test_service().await;
        let fast_rolling_stock = fast_rolling_stock.await;
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
        assert_eq!(response.status(), StatusCode::OK);

        let rolling_stock: RollingStock = read_body_json(response).await;
        assert_eq!(rolling_stock.name, "other_rolling_stock");
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

        let body: JsonValue = read_body_json(response).await;
        let error: InternalError = RollingStockError::NameAlreadyUsed {
            name: String::from("other_rolling_stock"),
        }
        .into();
        assert_eq!(to_value(error).unwrap(), body);
    }
}
