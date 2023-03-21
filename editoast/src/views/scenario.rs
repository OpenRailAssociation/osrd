use actix_web::{dev::HttpServiceFactory, web};

/// Returns `/projects/{project}/studies/{study}/scenarios` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/scenarios")
}
