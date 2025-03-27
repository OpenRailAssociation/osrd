use std::collections::HashMap;

use actix_session::Session;
use actix_web::{HttpRequest, HttpResponse, http::StatusCode};
use thiserror::Error;

use super::providers::{
    IdentityProvider, LoginResponse, LogoutResponse, ProviderIdentityStatus, ProviderSessionStatus,
    SessionProvider,
};

use super::DynSessionProvider;

#[derive(Clone, Copy, PartialEq)]
pub struct SessionProviderHandler(usize);

#[derive(Clone, Copy, PartialEq)]
pub struct IdentityProviderHandler(usize);

#[derive(Clone, Copy, PartialEq)]
pub enum AuthProviderHandler {
    Session(SessionProviderHandler),
    Identity(IdentityProviderHandler),
}

pub enum SessionStatus {
    LoggedIn {
        provider_handler: SessionProviderHandler,
        user_id: String,
        username: String,
    },
    // Requires to log in
    LoggedOut,
    // something bad happened
    Error(&'static str),
}

impl SessionStatus {
    fn new(provider_handler: SessionProviderHandler, status: ProviderSessionStatus) -> Self {
        match status {
            ProviderSessionStatus::LoggedIn { user_id, username } => SessionStatus::LoggedIn {
                provider_handler,
                user_id,
                username,
            },
            ProviderSessionStatus::LoggedOut => SessionStatus::LoggedOut,
            ProviderSessionStatus::Error(err) => SessionStatus::Error(err),
        }
    }

    fn into_auth(self) -> AuthStatus {
        match self {
            SessionStatus::LoggedIn {
                provider_handler,
                user_id,
                username,
            } => AuthStatus::Known {
                provider_handler: AuthProviderHandler::Session(provider_handler),
                user_id,
                username: Some(username),
            },
            SessionStatus::LoggedOut => AuthStatus::Unknown,
            SessionStatus::Error(err) => AuthStatus::Error(err),
        }
    }
}

pub enum AuthStatus {
    Known {
        provider_handler: AuthProviderHandler,
        user_id: String,
        username: Option<String>,
    },
    Unknown,
    Error(&'static str),
}

/// The auth context contains all the parameters required to check user authentication,
/// and authenticate new users.
#[derive(Clone)]
pub struct AuthContext {
    session_namespace: String,
    identity_providers: Vec<(String, Box<dyn IdentityProvider + Send>)>,
    session_providers: Vec<(String, Box<dyn DynSessionProvider + Send>)>,
    providers: HashMap<String, AuthProviderHandler>,
    default_session_provider: Option<SessionProviderHandler>,
}

impl AuthContext {
    pub fn new(session_namespace: String) -> Self {
        AuthContext {
            session_namespace,
            identity_providers: Vec::new(),
            session_providers: Vec::new(),
            providers: HashMap::new(),
            default_session_provider: None,
        }
    }

    pub fn set_default_provider(&mut self, provider: SessionProviderHandler) {
        self.default_session_provider = Some(provider);
    }

    pub(crate) fn session_key(&self, path: &[&str]) -> String {
        let mut res = self.session_namespace.clone();
        for e in path {
            res.push('.');
            res.push_str(e);
        }
        res
    }

    pub(crate) fn session_provider_key(&self, provider_id: &str) -> String {
        self.session_key(&["provider", provider_id])
    }

    pub fn get_session_provider_id(&self, handler: SessionProviderHandler) -> &str {
        &self.session_providers[handler.0].0
    }

    pub fn get_identity_provider_id(&self, handler: IdentityProviderHandler) -> &str {
        &self.identity_providers[handler.0].0
    }

    pub fn get_provider_id(&self, handler: AuthProviderHandler) -> &str {
        match handler {
            AuthProviderHandler::Session(handler) => self.get_session_provider_id(handler),
            AuthProviderHandler::Identity(handler) => self.get_identity_provider_id(handler),
        }
    }

    pub fn get_provider_handler(&self, provider_id: &str) -> Option<AuthProviderHandler> {
        self.providers.get(provider_id).copied()
    }

    pub fn get_session_provider(&self, handler: SessionProviderHandler) -> &dyn DynSessionProvider {
        self.session_providers[handler.0].1.as_ref()
    }

    pub fn get_identity_provider(&self, handler: IdentityProviderHandler) -> &dyn IdentityProvider {
        self.identity_providers[handler.0].1.as_ref()
    }

    pub fn add_identity_provider(
        &mut self,
        provider_id: String,
        provider: impl IdentityProvider + 'static + Send,
    ) -> IdentityProviderHandler {
        let provider_handler = IdentityProviderHandler(self.identity_providers.len());
        self.identity_providers
            .push((provider_id.clone(), Box::new(provider)));
        self.providers
            .insert(provider_id, AuthProviderHandler::Identity(provider_handler));
        provider_handler
    }

    pub fn add_session_provider(
        &mut self,
        provider_id: String,
        provider: impl SessionProvider + 'static + Send,
    ) -> SessionProviderHandler {
        let provider_handler = SessionProviderHandler(self.session_providers.len());
        self.session_providers
            .push((provider_id.clone(), provider.into()));
        self.providers
            .insert(provider_id, AuthProviderHandler::Session(provider_handler));
        provider_handler
    }

    fn get_active_provider(&self, session: &Session) -> Option<SessionProviderHandler> {
        let session_key = self.session_key(&["active_provider"]);
        let provider_id = match session.get::<Option<String>>(&session_key) {
            // the key is present with a value
            Ok(Some(Some(value))) => value,
            // the key is present with null
            Ok(Some(None)) => return None,
            // the key is missing
            Ok(None) => return None,
            Err(_) => {
                log::warn!("invalid active provider");
                session.remove(&session_key);
                return None;
            }
        };

        match self.get_provider_handler(&provider_id) {
            Some(AuthProviderHandler::Session(handler)) => Some(handler),
            Some(AuthProviderHandler::Identity(_)) => {
                log::warn!("the active session provider is not a session provider");
                session.remove(&session_key);
                None
            }
            None => None,
        }
    }

    pub(crate) fn set_active_provider(&self, session: &Session, provider: Option<&str>) {
        let session_key = self.session_key(&["active_provider"]);
        if session
            .insert::<Option<&str>>(session_key, provider)
            .is_err()
        {
            log::warn!("failed to serialize the session key to string");
        }
    }

    pub fn get_session_status(&self, req: &HttpRequest, session: Session) -> SessionStatus {
        let Some(handler) = self.get_active_provider(&session) else {
            return SessionStatus::LoggedOut;
        };

        let session_provider = self.get_session_provider(handler);
        let provider_id = self.get_session_provider_id(handler);
        let provider_status = session_provider.get_session(self, session, provider_id, req);
        SessionStatus::new(handler, provider_status)
    }

    pub fn get_auth_status(&self, req: &HttpRequest, session: Session) -> AuthStatus {
        for (provider_id, id_provider) in &self.identity_providers {
            let Some(handler) = self.get_provider_handler(provider_id) else {
                continue;
            };

            match id_provider.get_identity(req) {
                ProviderIdentityStatus::Known { user_id, username } => {
                    return AuthStatus::Known {
                        provider_handler: handler,
                        user_id,
                        username,
                    };
                }
                ProviderIdentityStatus::Unknown => continue,
                ProviderIdentityStatus::Error(msg) => {
                    return AuthStatus::Error(msg);
                }
            }
        }

        self.get_session_status(req, session).into_auth()
    }

    pub fn iter_session_providers(&self) -> impl Iterator<Item = SessionProviderHandler> {
        (0..self.session_providers.len()).map(SessionProviderHandler)
    }

    pub fn login(
        &self,
        req: &HttpRequest,
        session: Session,
        session_provider: Option<&str>,
    ) -> Result<LoginResponse, actix_web::Error> {
        // find the requested session handler, if any
        let req_provider_handler = if let Some(provider_id) = session_provider {
            // if there's a session provider id, try to use it
            match self.get_provider_handler(provider_id) {
                Some(AuthProviderHandler::Session(session_handler)) => Some(session_handler),
                Some(AuthProviderHandler::Identity(_)) => {
                    return Err(LoginError::InvalidProviderId.into());
                }
                None => return Err(LoginError::ProviderNotFound.into()),
            }
        } else {
            None
        };

        let mut session_state = self.get_session_status(req, session.clone());

        // if the user requested a specific provider and it's not the same as the currently active one,
        // log out and log in with the requested provider. Otherwise, just return the login response
        if let (
            SessionStatus::LoggedIn {
                provider_handler, ..
            },
            Some(req_provider),
        ) = (&session_state, req_provider_handler)
        {
            let provider_handler = *provider_handler;
            if provider_handler != req_provider {
                let provider = self.get_session_provider(provider_handler);
                provider.logout(
                    self,
                    session.clone(),
                    self.get_session_provider_id(provider_handler),
                    req,
                )?;
                session_state = SessionStatus::LoggedOut;
            }
        }

        // if the user is already logged in, return early
        if let SessionStatus::LoggedIn { username, .. } = session_state {
            return Ok(LoginResponse::Success { username });
        }

        // find out which session provider to initiate login with
        let req_provider_handler = if let Some(req_provider_handler) = req_provider_handler {
            // if the user requested a provider, use it
            req_provider_handler
        } else if let Some(default_handler) = self.default_session_provider {
            // otherwise, try to use the default.
            default_handler
        } else {
            // If there's no default, it's an error
            return Err(LoginError::NoDefaultProvider.into());
        };

        let provider = self.get_session_provider(req_provider_handler);
        let provider_id = self.get_session_provider_id(req_provider_handler);
        provider.login(self, session.clone(), provider_id, req)
    }

    pub fn logout(
        &self,
        req: &HttpRequest,
        session: Session,
    ) -> Result<LogoutResponse, actix_web::Error> {
        let Some(session_handler) = self.get_active_provider(&session) else {
            return Ok(LogoutResponse::Success);
        };

        let provider_id = self.get_session_provider_id(session_handler);
        let provider = self.get_session_provider(session_handler);
        provider.logout(self, session.clone(), provider_id, req)?;
        Ok(LogoutResponse::Success)
    }

    pub async fn callback(
        &self,
        req: HttpRequest,
        session: Session,
        provider_id: &str,
    ) -> Result<HttpResponse, actix_web::Error> {
        let Some(provider) = self.providers.get(provider_id) else {
            return Err(CallbackError::ProviderNotFound.into());
        };

        match provider {
            AuthProviderHandler::Session(session_handler) => {
                let provider = self.get_session_provider(*session_handler);
                let res = provider.callback(self, session, provider_id, req).await?;
                Ok(res)
            }
            AuthProviderHandler::Identity(_) => Err(LogoutError::ProviderNotFound.into()),
        }
    }
}

#[derive(Debug, Error)]
pub enum LoginError {
    #[error("No such provider")]
    ProviderNotFound,
    #[error("This provider ID does not correspond to a session provider")]
    InvalidProviderId,
    #[error("No default provider")]
    NoDefaultProvider,
}

#[derive(Debug, Error)]
pub enum LogoutError {
    #[error("No such provider")]
    ProviderNotFound,
}

#[derive(Debug, Error)]
pub enum CallbackError {
    #[error("No such provider")]
    ProviderNotFound,
}

impl actix_web::ResponseError for LoginError {
    fn status_code(&self) -> StatusCode {
        match self {
            LoginError::ProviderNotFound => StatusCode::BAD_REQUEST,
            LoginError::InvalidProviderId => StatusCode::BAD_REQUEST,
            LoginError::NoDefaultProvider => StatusCode::BAD_REQUEST,
        }
    }
}

impl actix_web::ResponseError for LogoutError {
    fn status_code(&self) -> StatusCode {
        match self {
            LogoutError::ProviderNotFound => StatusCode::BAD_REQUEST,
        }
    }
}

impl actix_web::ResponseError for CallbackError {
    fn status_code(&self) -> StatusCode {
        match self {
            CallbackError::ProviderNotFound => StatusCode::BAD_REQUEST,
        }
    }
}
