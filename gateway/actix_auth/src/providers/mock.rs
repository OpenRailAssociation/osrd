use actix_web::HttpRequest;
use serde::{Deserialize, Serialize};

use super::{ProviderSessionStatus, SessionProvider};

#[derive(Clone)]
pub struct MockProvider {
    require_login: bool,
    username: String,
}

impl MockProvider {
    pub fn new(require_login: bool, username: String) -> Self {
        Self {
            require_login,
            username,
        }
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
        if self.require_login && ctx.state().is_none() {
            ProviderSessionStatus::LoggedOut
        } else {
            ProviderSessionStatus::LoggedIn {
                user_id: self.username.clone(),
                username: self.username.clone(),
            }
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
