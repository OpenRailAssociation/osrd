use std::{
    future::{Future, Ready, ready},
    pin::Pin,
};

use actix_web::{
    Error,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
};

use actix_web::http::header::CONTENT_SECURITY_POLICY;

pub struct Csp;

// `S` - type of the next service
// `B` - type of response's body
impl<S, B> Transform<S, ServiceRequest> for Csp
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = CSPMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(CSPMiddleware { service }))
    }
}

pub struct CSPMiddleware<S> {
    /// The next service to call
    service: S,
}

// This future doesn't have the requirement of being `Send`.
// See: futures_util::future::LocalBoxFuture
type LocalBoxFuture<T> = Pin<Box<dyn Future<Output = T> + 'static>>;

// `S`: type of the wrapped service
// `B`: type of the body - try to be generic over the body where possible
impl<S, B> Service<ServiceRequest> for CSPMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<Result<Self::Response, Self::Error>>;

    // This service is ready when its next service is ready
    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let csp_string = if req.path().starts_with("/netzgrafik-frontend/") {
            concat!(
                "default-src 'self'; ",
                "connect-src 'self' https://icons.app.sbb.ch; ",
                "font-src 'self' https://cdn.app.sbb.ch; ",
                "form-action 'self'; ",
                "frame-ancestors 'self'; ",
                "frame-src 'none'; ",
                "img-src 'self' data: https://icons.app.sbb.ch; ",
                "object-src 'none'; ",
                "style-src 'self' 'unsafe-inline' https://cdn.app.sbb.ch; ",
            )
        } else {
            concat!(
                "default-src 'self'; ",
                "connect-src 'self' https://tuiles.enliberte.fr/; ",
                "data:; ",
                "font-src 'self'; ",
                "form-action 'self'; ",
                "frame-ancestors 'self'; ",
                "img-src 'self' data:; ",
                "style-src 'self'; ",
                "worker-src 'self' blob:; ",
            )
        };

        let fut = self.service.call(req);

        Box::pin(async move {
            let mut res = fut.await?;
            if !res.headers().contains_key(CONTENT_SECURITY_POLICY) {
                res.headers_mut().insert(
                    CONTENT_SECURITY_POLICY,
                    actix_web::http::header::HeaderValue::from_static(csp_string),
                );
            }
            Ok(res)
        })
    }
}
