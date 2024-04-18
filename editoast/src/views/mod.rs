mod documents;
pub mod electrical_profiles;
pub mod infra;
mod layers;
pub mod light_rolling_stocks;
pub mod openapi;
pub mod pagination;
pub mod params;
pub mod pathfinding;
pub mod projects;
pub mod rolling_stocks;
pub mod scenario;
pub mod search;
mod single_simulation;
pub mod sprites;
pub mod stdcm;
pub mod study;
pub mod timetable;
pub mod train_schedule;
pub mod v2;
pub mod work_schedules;

use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::services;
use actix_web::web::Data;
use actix_web::web::Json;
use diesel::sql_query;
use itertools::Itertools;
use redis::cmd;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use tracing::debug;
use utoipa::openapi::RefOr;
use utoipa::OpenApi;
use utoipa::ToSchema;

use self::openapi::merge_path_items;
use self::openapi::remove_discriminator;
use self::openapi::OpenApiMerger;
use self::openapi::Routes;
use crate::client::get_app_version;
use crate::core::version::CoreVersionRequest;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::core::{self};
use crate::error::ErrorDefinition;
use crate::error::Result;
use crate::error::{self};
use crate::infra_cache::operation;
use crate::models;
use crate::modelsv2;
use crate::DbPool;
use crate::RedisClient;

// This function is only temporary while our migration to using utoipa is
// still going

fn routes_v2() -> Routes<impl HttpServiceFactory> {
    crate::routes! {
        (health, version, core_version),
        (rolling_stocks::routes(), light_rolling_stocks::routes()),
        (pathfinding::routes(), stdcm::routes(), train_schedule::routes()),
        (projects::routes(),timetable::routes(), work_schedules::routes()),
        documents::routes(),
        sprites::routes(),
        search::routes(),
        electrical_profiles::routes(),
        layers::routes(),
        infra::routes(),
        single_simulation::routes(),
        v2::routes()
    }
    routes()
}

pub fn routes() -> impl HttpServiceFactory {
    services![infra::infra_routes(), routes_v2(),]
}

editoast_common::schemas! {
    error::schemas(),
    models::schemas(),
    modelsv2::schemas(),
    core::schemas(),
    Version,
    timetable::schemas(),
    documents::schemas(),
    pathfinding::schemas(),
    projects::schemas(),
    search::schemas(),
    train_schedule::schemas(),
    rolling_stocks::schemas(),
    light_rolling_stocks::schemas(),
    electrical_profiles::schemas(),
    infra::schemas(),
    single_simulation::schemas(),
    v2::schemas(),
    work_schedules::schemas(),
    editoast_common::schemas(),
    operation::schemas(),
    editoast_schemas::schemas(),
}

#[derive(OpenApi)]
#[openapi(
    info(description = "My Api description"),
    tags(),
    paths(),
    components(responses())
)]
pub struct OpenApiRoot;

impl OpenApiRoot {
    // RTK doesn't support the discriminator: property everywhere utoipa
    // puts it. So we remove it, even though utoipa is correct.
    fn remove_discrimators(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                if let Some(request_body) = operation.request_body.as_mut() {
                    for (_, content) in request_body.content.iter_mut() {
                        remove_discriminator(&mut content.schema);
                    }
                }
                for (_, response) in operation.responses.responses.iter_mut() {
                    match response {
                        RefOr::T(response) => {
                            for (_, content) in response.content.iter_mut() {
                                remove_discriminator(&mut content.schema);
                            }
                        }
                        RefOr::Ref { .. } => panic!("editoast doesn't support response references"),
                    }
                }
            }
        }
        if let Some(components) = openapi.components.as_mut() {
            for component in components.schemas.values_mut() {
                remove_discriminator(component);
            }
        }
    }

    // utoipa::path doesn't support multiple tags, so this is a hack to split them
    // A PR on utoipa might be a good idea
    // Split comma-separated tags into multiple tags
    fn split_tags(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                operation.tags = operation.tags.as_ref().map(|tags| {
                    tags.iter()
                        .flat_map(|tag| tag.split(','))
                        .map(|tag| tag.trim().to_owned())
                        .collect()
                });
            }
        }
    }

    fn error_context_to_openapi_object(error_def: &ErrorDefinition) -> utoipa::openapi::Object {
        let mut context = utoipa::openapi::Object::new();
        // We write openapi propertiesd by alpha order, to keep the same yml file
        for prop_name in error_def.get_context().keys().sorted() {
            let prop_type = &error_def.get_context()[prop_name];
            context.properties.insert(
                prop_name.clone(),
                utoipa::openapi::ObjectBuilder::new()
                    .schema_type(match prop_type.as_ref() {
                        "bool" => utoipa::openapi::SchemaType::Boolean,
                        "isize" => utoipa::openapi::SchemaType::Integer,
                        "i8" => utoipa::openapi::SchemaType::Integer,
                        "i16" => utoipa::openapi::SchemaType::Integer,
                        "i32" => utoipa::openapi::SchemaType::Integer,
                        "i64" => utoipa::openapi::SchemaType::Integer,
                        "usize" => utoipa::openapi::SchemaType::Integer,
                        "u8" => utoipa::openapi::SchemaType::Integer,
                        "u16" => utoipa::openapi::SchemaType::Integer,
                        "u32" => utoipa::openapi::SchemaType::Integer,
                        "u64" => utoipa::openapi::SchemaType::Integer,
                        "f8" => utoipa::openapi::SchemaType::Number,
                        "f16" => utoipa::openapi::SchemaType::Number,
                        "f32" => utoipa::openapi::SchemaType::Number,
                        "f64" => utoipa::openapi::SchemaType::Number,
                        "Vec" => utoipa::openapi::SchemaType::Array,
                        "char" => utoipa::openapi::SchemaType::String,
                        "String" => utoipa::openapi::SchemaType::String,
                        _ => utoipa::openapi::SchemaType::Object,
                    })
                    .into(),
            );
            context.required.push(prop_name.clone());
        }
        context
    }

    // Add errors in openapi schema
    fn add_errors_in_schema(openapi: &mut utoipa::openapi::OpenApi) {
        // Building the generic editoast error
        let mut editoast_error = utoipa::openapi::OneOf::new();
        editoast_error.description = Some("Generated error type for Editoast".to_string());
        editoast_error.discriminator = Some(utoipa::openapi::Discriminator::new("type"));

        // Adding all error type to openapi
        // alpha sorted by name, to keep the same file (there is no order guarantee with inventory)
        let mut errors: Vec<&ErrorDefinition> = vec![];
        for error_def in inventory::iter::<ErrorDefinition> {
            errors.push(error_def);
        }
        errors.sort_by(|a, b| a.namespace.cmp(b.namespace).then(a.id.cmp(b.id)));
        for error_def in errors {
            openapi.components.as_mut().unwrap().schemas.insert(
                error_def.get_schema_name(),
                utoipa::openapi::ObjectBuilder::new()
                    .property(
                        "type",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::SchemaType::String)
                            .enum_values(Some([error_def.id])),
                    )
                    .property(
                        "status",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::SchemaType::Integer)
                            .enum_values(Some([error_def.status])),
                    )
                    .property(
                        "message",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::SchemaType::String),
                    )
                    .property("context", Self::error_context_to_openapi_object(error_def))
                    .required("type")
                    .required("status")
                    .required("message")
                    .into(),
            );

            // Adding the ref of the error to the generic error
            editoast_error.items.push(
                utoipa::openapi::Ref::new(format!(
                    "#/components/schemas/{}",
                    error_def.get_schema_name()
                ))
                .into(),
            );
        }

        // Adding generic error to openapi
        openapi.components.as_mut().unwrap().schemas.insert(
            String::from("EditoastError"),
            utoipa::openapi::OneOfBuilder::from(editoast_error).into(),
        );
    }

    pub fn build_openapi() -> serde_json::Value {
        let manual = include_str!("../../openapi_legacy.yaml").to_owned();
        let mut openapi = OpenApiRoot::openapi();

        let routes = routes_v2();
        for (path, path_item) in routes.paths.into_flat_path_list() {
            debug!("processing {path}");
            if openapi.paths.paths.contains_key(&path) {
                let existing_path_item = openapi.paths.paths.remove(&path).unwrap();
                let merged = merge_path_items(existing_path_item, path_item);
                openapi.paths.paths.insert(path, merged);
            } else {
                openapi.paths.paths.insert(path, path_item);
            }
        }

        if openapi.components.is_none() {
            openapi.components = Some(Default::default());
        }
        openapi
            .components
            .as_mut()
            .unwrap()
            .schemas
            .extend(schemas());

        Self::remove_discrimators(&mut openapi);
        Self::split_tags(&mut openapi);
        Self::add_errors_in_schema(&mut openapi);

        // Remove the operation_id that defaults to the endpoint function name
        // so that it doesn't override the RTK methods names.
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                operation.operation_id = None;
                // By default utoipa adds a tag "crate" to operations that don't have
                // any. That causes problems with RTK tag management.
                match &operation.tags {
                    Some(tags) if tags.len() == 1 && tags.first().unwrap() == "crate" => {
                        operation.tags = None;
                    }
                    _ => (),
                }
            }
        }
        let generated = openapi
            .to_json()
            .expect("the openapi should generate properly");
        OpenApiMerger::new(manual, generated)
            .smart_merge()
            .add_trailing_slash_to_paths()
            .finish()
    }
}

#[utoipa::path(
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
#[get("/health")]
async fn health(db_pool: Data<DbPool>, redis_client: Data<RedisClient>) -> Result<&'static str> {
    use diesel_async::RunQueryDsl;
    let mut conn = db_pool.get().await?;
    sql_query("SELECT 1").execute(&mut conn).await?;

    let mut conn = redis_client.get_connection().await?;
    cmd("PING").query_async::<_, ()>(&mut conn).await.unwrap();
    Ok("ok")
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct Version {
    #[schema(required)] // Options are by default not required, but this one is
    git_describe: Option<String>,
}

#[utoipa::path(
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
#[get("/version")]
async fn version() -> Json<Version> {
    Json(Version {
        git_describe: get_app_version(),
    })
}

#[utoipa::path(
    responses(
        (status = 200, description = "Return the core service version", body = Version),
    ),
)]
#[get("/version/core")]
async fn core_version(core: Data<CoreClient>) -> Json<Version> {
    let response = CoreVersionRequest {}.fetch(&core).await;
    let response = response.unwrap_or(Version { git_describe: None });
    Json(response)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_http::body::BoxBody;
    use actix_http::Request;
    use actix_http::StatusCode;
    use actix_web::dev::Service;
    use actix_web::dev::ServiceResponse;
    use actix_web::middleware::NormalizePath;
    use actix_web::test as actix_test;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::init_service;
    use actix_web::test::TestRequest;
    use actix_web::web::Data;
    use actix_web::web::JsonConfig;
    use actix_web::App;
    use actix_web::Error;
    use chashmap::CHashMap;
    use diesel_async::pooled_connection::deadpool::Pool;
    use diesel_async::pooled_connection::AsyncDieselConnectionManager as ConnectionManager;
    use diesel_async::AsyncPgConnection as PgConnection;

    use super::routes;
    use super::OpenApiRoot;
    use crate::client::MapLayersConfig;
    use crate::client::PostgresConfig;
    use crate::client::RedisConfig;
    use crate::core::mocking::MockingClient;
    use crate::core::CoreClient;
    use crate::error::InternalError;
    use crate::infra_cache::InfraCache;
    use crate::map::MapLayers;
    use crate::RedisClient;

    /// Asserts the status code of a simulated response and deserializes its body,
    /// with a nice failure message should the something fail
    #[macro_export]
    macro_rules! assert_status_and_read {
        ($response: ident, $status: expr) => {{
            let (status, body): (_, std::result::Result<serde_json::Value, _>) = (
                $response.status(),
                actix_web::test::try_read_body_json($response).await,
            );
            if let std::result::Result::Ok(body) = body {
                let fmt_body = format!("{}", body);
                assert_eq!(status, $status, "unexpected error response: {}", fmt_body);
                match serde_json::from_value(body) {
                    Ok(response) => response,
                    Err(err) => panic!(
                        "cannot deserialize response because '{}': {}",
                        err, fmt_body
                    ),
                }
            } else {
                panic!(
                    "Cannot read response body: {:?}\nGot status code {}",
                    body.unwrap_err(),
                    status
                )
            }
        }};
    }

    /// Checks if the field "type" of the response matches the `type` field of
    /// the `InternalError` derived from the provided error
    ///
    /// The other error fields (message, status_code and context) are ignored.
    #[macro_export]
    macro_rules! assert_response_error_type_match {
        ($response: ident, $error: expr) => {{
            let expected_error: $crate::error::InternalError = $error.into();
            let payload: serde_json::Value = actix_web::test::try_read_body_json($response)
                .await
                .expect("cannot read response body");
            let error_type = payload.get("type").expect("invalid error format");
            assert_eq!(error_type, expected_error.get_type(), "error type mismatch");
        }};
    }

    /// Creates a test client with 1 pg connection and a given [CoreClient]
    pub async fn create_test_service_with_core_client<C: Into<CoreClient>>(
        core: C,
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        let pg_config_url = PostgresConfig::default()
            .url()
            .expect("cannot get postgres config url");
        let manager = ConnectionManager::<PgConnection>::new(pg_config_url.as_str());
        let pool = Pool::builder(manager)
            .build()
            .expect("Failed to create pool.");
        let redis = RedisClient::new(RedisConfig::default()).expect("cannot get redis client");

        // Custom Json extractor configuration
        let json_cfg = JsonConfig::default()
            .limit(250 * 1024 * 1024) // 250MB
            .error_handler(|err, _| InternalError::from(err).into());

        let core: CoreClient = core.into();
        let app = App::new()
            .wrap(NormalizePath::trim())
            .app_data(json_cfg)
            .app_data(Data::new(pool))
            .app_data(Data::new(redis))
            .app_data(Data::new(CHashMap::<i64, InfraCache>::default()))
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(MapLayersConfig::default()))
            .app_data(Data::new(core))
            .service(routes());
        init_service(app).await
    }

    /// Create a test editoast client
    /// This client create a single new connection to the database
    pub async fn create_test_service(
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        create_test_service_with_core_client(CoreClient::default()).await
    }

    #[actix_test]
    async fn health() {
        let service = create_test_service().await;
        let request = TestRequest::get().uri("/health").to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());
    }

    #[actix_test]
    async fn version() {
        let service = create_test_service().await;
        let request = TestRequest::get().uri("/version").to_request();
        let response: HashMap<String, Option<String>> =
            call_and_read_body_json(&service, request).await;
        assert!(response.contains_key("git_describe"));
    }

    #[actix_test]
    async fn core_version() {
        let mut core = MockingClient::new();
        core.stub("/version")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(r#"{"git_describe": ""}"#)
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let request = TestRequest::get().uri("/version/core").to_request();
        let response: HashMap<String, Option<String>> =
            call_and_read_body_json(&app, request).await;
        assert!(response.contains_key("git_describe"));
    }

    #[test]
    fn openapi_merge_goes_well() {
        let _ = OpenApiRoot::build_openapi(); // panics if something is wrong
    }
}
