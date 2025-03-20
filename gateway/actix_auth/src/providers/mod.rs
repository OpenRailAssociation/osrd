use std::future::ready;

use actix_web::{HttpRequest, HttpResponse};
pub use bearer::BearerProvider;
use dyn_clone::DynClone;
use futures_util::future::LocalBoxFuture;
pub use mock::MockProvider;
pub use oidc::{OidcConfig, OidcProvider};
pub use provider_context::ProviderContext;
use serde::{Deserialize, Serialize};

pub mod bearer;
pub mod mock;
pub mod oidc;

mod provider_context;

pub enum ProviderIdentityStatus {
    Known {
        user_id: String,
        username: Option<String>,
    },
    Unknown,
    Error(&'static str),
}

/// Identity providers can establish user identity without the need for a session.
/// No cookies are used to track anything whatsoever.
pub trait IdentityProvider: DynClone {
    fn get_identity(&self, req: &HttpRequest) -> ProviderIdentityStatus;
}

dyn_clone::clone_trait_object!(IdentityProvider);

pub enum ProviderSessionStatus {
    LoggedIn { user_id: String, username: String },
    // Requires to log in
    LoggedOut,
    // something bad happened
    Error(&'static str),
}

/// Sessions are meant for interactive users
pub trait SessionProvider: Clone {
    type SessionState: Serialize + for<'de> Deserialize<'de> + Clone;

    fn backend_id() -> &'static str;

    fn get_session<'req>(
        &self,
        ctx: &mut ProviderContext<'req, Self>,
        req: &'req HttpRequest,
    ) -> ProviderSessionStatus;

    fn login<'req>(
        &self,
        ctx: &mut ProviderContext<'req, Self>,
        req: &'req HttpRequest,
    ) -> Result<LoginResponse, actix_web::Error>;

    fn logout<'req>(
        &self,
        ctx: &mut ProviderContext<'req, Self>,
        req: &'req HttpRequest,
    ) -> Result<LogoutResponse, actix_web::Error>;

    /// Some session provider backends, such as OpenID connect, require additional interactions during the authentication flow
    fn callback<'req, 'ctx>(
        &'req self,
        _: &'ctx mut ProviderContext<'req, Self>,
        _: HttpRequest,
    ) -> LocalBoxFuture<'ctx, Result<HttpResponse, actix_web::Error>> {
        Box::pin(ready(Ok(HttpResponse::NotFound().finish())))
    }
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum LoginResponse {
    #[serde(rename = "success")]
    Success {
        /// the username of the logged-in user
        username: String,
    },
    #[serde(rename = "redirect")]
    Redirect {
        /// The url of the login portal
        url: String,
    },
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum LogoutResponse {
    #[serde(rename = "success")]
    Success,
}
