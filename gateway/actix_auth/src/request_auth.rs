use std::{
    future::{Ready, ready},
    rc::Rc,
};

use actix_web::HttpMessage;
use actix_web::dev::{Extensions, Payload};
use actix_web::{FromRequest, HttpRequest, error::ErrorInternalServerError};

use crate::{AuthContext, AuthStatus};

#[derive(Clone)]
pub struct RequestAuth(Rc<RequestAuthInner>);

struct RequestAuthInner {
    context: Rc<AuthContext>,
    status: AuthStatus,
}

impl RequestAuth {
    pub(crate) fn new(context: Rc<AuthContext>, status: AuthStatus) -> Self {
        RequestAuth(Rc::new(RequestAuthInner { context, status }))
    }

    pub fn context(&self) -> &AuthContext {
        &self.0.context
    }

    pub fn status(&self) -> &AuthStatus {
        &self.0.status
    }

    pub fn from_extensions(extensions: &Extensions) -> Option<Self> {
        extensions.get::<Self>().cloned()
    }
}

impl FromRequest for RequestAuth {
    type Error = actix_web::Error;

    type Future = Ready<Result<Self, actix_web::Error>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        ready(Self::from_extensions(&req.extensions()).ok_or_else(|| {
            log::debug!("failed to get RequestAuth. Request path: {:?}", req.path());
            ErrorInternalServerError("Missing expected request extension data")
        }))
    }
}

pub trait RequestAuthExt {
    fn get_request_auth(&self) -> Option<RequestAuth>;
}

impl RequestAuthExt for HttpRequest {
    fn get_request_auth(&self) -> Option<RequestAuth> {
        RequestAuth::from_extensions(&self.extensions())
    }
}

impl RequestAuthExt for actix_web::dev::ServiceRequest {
    fn get_request_auth(&self) -> Option<RequestAuth> {
        RequestAuth::from_extensions(&self.extensions())
    }
}

impl RequestAuthExt for actix_web::dev::ServiceResponse {
    fn get_request_auth(&self) -> Option<RequestAuth> {
        self.request().get_request_auth()
    }
}

impl RequestAuthExt for actix_web::guard::GuardContext<'_> {
    fn get_request_auth(&self) -> Option<RequestAuth> {
        RequestAuth::from_extensions(&self.req_data())
    }
}
