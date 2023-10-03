///
/// The auth module is responsible for:
///  - logging in interactive users
///  - authenticating logged in users, and providing identity metadata
///  - providing a logout API
///  - authenticating non-interactive users, such as holders of a bearer tokens
mod auth_context;
pub use auth_context::{AuthContext, AuthProviderHandler, AuthStatus, SessionStatus};

mod dyn_session_provider;
pub use dyn_session_provider::DynSessionProvider;

mod providers;
pub use providers::{BearerProvider, MockProvider, OidcConfig, OidcProvider};
pub use providers::{IdentityProvider, SessionProvider};

pub mod oidc {
    // these types are required to parse the oidc configuration, and thus are re-exported
    pub use openidconnect::{IssuerUrl, RedirectUrl};
    pub use url::Url;
}

mod auth_middleware;
pub use auth_middleware::AuthMiddleware;

mod request_auth;
pub use request_auth::{RequestAuth, RequestAuthExt};

mod service;
pub use service::config;
