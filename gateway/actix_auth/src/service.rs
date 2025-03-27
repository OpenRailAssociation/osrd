use crate::RequestAuth;
use actix_session::Session;
use actix_web::{HttpRequest, HttpResponse, Responder, web};
use serde::Serialize;

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("/login", web::post().to(login));
    cfg.route("/logout", web::post().to(logout));
    cfg.route("/providers", web::get().to(get_providers));
    cfg.service(
        web::scope("/provider/{provider_id}")
            .route("/login", web::post().to(service_login))
            .route("/callback", web::get().to(service_callback)),
    );
}

#[derive(Serialize)]
struct SessionProvider {
    provider_id: String,
    backend: String,
}

async fn get_providers(auth: RequestAuth) -> impl Responder {
    let mut providers = vec![];
    for handler in auth.context().iter_session_providers() {
        let provider_id = auth.context().get_session_provider_id(handler);
        let provider = auth.context().get_session_provider(handler);

        providers.push(SessionProvider {
            provider_id: provider_id.to_owned(),
            backend: provider.backend_id().to_owned(),
        })
    }
    HttpResponse::Ok().json(providers)
}

async fn login(req: HttpRequest, auth: RequestAuth, session: Session) -> impl Responder {
    auth.context()
        .login(&req, session, None)
        .map(|r| HttpResponse::Ok().json(r))
}

async fn logout(req: HttpRequest, auth: RequestAuth, session: Session) -> impl Responder {
    auth.context()
        .logout(&req, session)
        .map(|r| HttpResponse::Ok().json(r))
}

async fn service_login(
    req: HttpRequest,
    auth: RequestAuth,
    session: Session,
    provider_id: web::Path<String>,
) -> impl Responder {
    auth.context()
        .login(&req, session, Some(provider_id.as_str()))
        .map(|r| HttpResponse::Ok().json(r))
}

async fn service_callback(
    req: HttpRequest,
    auth: RequestAuth,
    session: Session,
    provider_id: web::Path<String>,
) -> impl Responder {
    auth.context()
        .callback(req, session, provider_id.as_str())
        .await
}
