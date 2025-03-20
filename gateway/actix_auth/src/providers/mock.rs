use actix_web::HttpRequest;
use serde::Deserialize;
use serde::Serialize;

use super::IdentityProvider;
use super::ProviderIdentityStatus;
use super::ProviderSessionStatus;
use super::SessionProvider;

#[derive(Clone)]
pub struct MockProvider {
    username: String,
    user_id: String,
}

impl MockProvider {
    pub fn new(username: String, user_id: String) -> Self {
        Self { username, user_id }
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
                user_id: self.user_id.clone(),
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
        ProviderIdentityStatus::Known {
            user_id: self.user_id.clone(),
            username: Some(self.username.clone()),
        }
    }
}
