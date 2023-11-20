use actix_web::HttpRequest;
use serde::{Deserialize, Serialize};

use super::{IdentityProvider, ProviderIdentityStatus, ProviderSessionStatus, SessionProvider};

#[derive(Clone)]
pub struct MockProvider {
    require_login: bool,
    username: String,
    user_id: Option<String>,
}

impl MockProvider {
    pub fn new(require_login: bool, username: String, user_id: Option<String>) -> Self {
        Self {
            require_login,
            username,
            user_id,
        }
    }

    fn get_user_id(&self) -> &str {
        self.user_id
            .as_deref()
            .unwrap_or_else(|| self.username.as_ref())
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub enum MockState {
    LoggedIn,
}

impl SessionProvider for MockProvider {
    type SessionState = MockState;

    fn backend_id() -> &'static str {
        "mock"
    }

    fn get_session(
        &self,
        ctx: &mut super::ProviderContext<Self>,
        _: &HttpRequest,
    ) -> ProviderSessionStatus {
        match ctx.state() {
            None => ProviderSessionStatus::LoggedOut,
            Some(MockState::LoggedIn) => ProviderSessionStatus::LoggedIn {
                user_id: self.get_user_id().to_owned(),
                username: self.username.clone(),
            },
        }
    }

    fn login(
        &self,
        ctx: &mut super::ProviderContext<Self>,
        _: &HttpRequest,
    ) -> Result<super::LoginResponse, actix_web::Error> {
        ctx.login(MockState::LoggedIn);
        Ok(super::LoginResponse::Success {
            username: self.username.clone(),
        })
    }

    fn logout(
        &self,
        ctx: &mut super::ProviderContext<Self>,
        _: &HttpRequest,
    ) -> Result<super::LogoutResponse, actix_web::Error> {
        ctx.logout();
        Ok(super::LogoutResponse::Success)
    }
}

impl IdentityProvider for MockProvider {
    fn get_identity(&self, _: &HttpRequest) -> ProviderIdentityStatus {
        if self.require_login {
            ProviderIdentityStatus::Unknown
        } else {
            ProviderIdentityStatus::Known {
                user_id: self.get_user_id().to_owned(),
            }
        }
    }
}
