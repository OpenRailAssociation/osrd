use std::{
    future::{ready, Ready},
    rc::Rc,
};

use actix_session::{Session, SessionExt};
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpRequest,
};

use crate::{AuthContext, RequestAuth};

pub trait AuthGate: Clone {
    fn filter(&self, req: &HttpRequest, session: Option<Session>) -> Option<actix_web::Error>;
}

/// The MandatoryIdentityMiddleware does not directly process requests.
/// When actix starts, new_transform is called once per worker to create
/// MandatoryIdentityService instances.
#[derive(Clone)]
pub struct AuthMiddleware {
    ctx: Rc<AuthContext>,
}

impl AuthMiddleware {
    pub fn new(ctx: Rc<AuthContext>) -> Self {
        AuthMiddleware { ctx }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    // type of the next service
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    // type of the body
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = S::Error;
    type InitError = ();
    type Transform = AuthService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    // when actix starts workers, new services are created per worker.
    // this function wraps a service into the middleware
    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthService::new(service, self.ctx.clone())))
    }
}

// The middleware service processes and forwards requests to a backend service
pub struct AuthService<S> {
    // The backend service is behind an Rc so the async move closure can keep a reference
    backend_service: Rc<S>,
    ctx: Rc<AuthContext>,
}

impl<S> AuthService<S> {
    fn new(service: S, ctx: Rc<AuthContext>) -> AuthService<S> {
        AuthService {
            backend_service: Rc::new(service),
            ctx,
        }
    }
}

impl<S, B> Service<ServiceRequest> for AuthService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = S::Future;

    forward_ready!(backend_service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let backend_service = Rc::clone(&self.backend_service);
        let status = self.ctx.get_auth_status(req.request(), req.get_session());
        req.extensions_mut()
            .insert(RequestAuth::new(self.ctx.clone(), status));
        backend_service.call(req)
    }
}
