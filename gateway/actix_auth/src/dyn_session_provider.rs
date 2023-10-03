use actix_session::Session;
use actix_web::{HttpRequest, HttpResponse};
use dyn_clone::DynClone;
use futures_util::future::LocalBoxFuture;
use serde::{Deserialize, Serialize};

use crate::{auth_context::AuthContext, providers::ProviderContext};

use super::providers::{LoginResponse, LogoutResponse, ProviderSessionStatus, SessionProvider};

/// An analogue of SessionProvider, which directly handles serializing and de-serializing session state
pub trait DynSessionProvider: DynClone {
    fn backend_id(&self) -> &'static str;

    fn get_session(
        &self,
        auth_context: &AuthContext,
        session: Session,
        session_key: &str,
        req: &HttpRequest,
    ) -> ProviderSessionStatus;

    fn login(
        &self,
        auth_context: &AuthContext,
        session: Session,
        provider_id: &str,
        req: &HttpRequest,
    ) -> Result<LoginResponse, actix_web::Error>;

    fn logout(
        &self,
        auth_context: &AuthContext,
        session: Session,
        provider_id: &str,
        req: &HttpRequest,
    ) -> Result<LogoutResponse, actix_web::Error>;

    fn callback<'req>(
        &'req self,
        auth_context: &'req AuthContext,
        session: Session,
        provider_id: &'req str,
        req: HttpRequest,
    ) -> LocalBoxFuture<'req, Result<HttpResponse, actix_web::Error>>;
}

dyn_clone::clone_trait_object!(DynSessionProvider);

impl<P: SessionProvider + 'static + Send> From<P> for Box<dyn DynSessionProvider + Send> {
    fn from(value: P) -> Self {
        Box::new(SessionProviderWrapper::new(value))
    }
}

/// a wrapper for SessionProvider, which implements SessionHandler
#[derive(Clone)]
struct SessionProviderWrapper<P>
where
    P::SessionState: Serialize + for<'de> Deserialize<'de> + Clone,
    P: SessionProvider,
{
    provider: P,
}

impl<P> SessionProviderWrapper<P>
where
    P::SessionState: Serialize + for<'de> Deserialize<'de> + Clone,
    P: SessionProvider,
{
    pub fn new(provider: P) -> Self {
        SessionProviderWrapper { provider }
    }
}

impl<P> DynSessionProvider for SessionProviderWrapper<P>
where
    P::SessionState: Serialize + for<'de> Deserialize<'de> + Clone,
    P: SessionProvider,
{
    fn backend_id(&self) -> &'static str {
        P::backend_id()
    }

    fn get_session(
        &self,
        auth_context: &AuthContext,
        session: Session,
        provider_id: &str,
        req: &HttpRequest,
    ) -> ProviderSessionStatus {
        let mut ctx = match ProviderContext::<P>::from_session(auth_context, provider_id, session) {
            Ok(var) => var,
            Err(_) => return ProviderSessionStatus::Error("session get error"),
        };
        let res = self.provider.get_session(&mut ctx, req);
        match ctx.commit() {
            Ok(_) => (),
            Err(_) => return ProviderSessionStatus::Error("couldn't set the session variable"),
        };
        res
    }

    fn login(
        &self,
        auth_context: &AuthContext,
        session: Session,
        provider_id: &str,
        req: &HttpRequest,
    ) -> Result<LoginResponse, actix_web::Error> {
        let mut ctx = ProviderContext::<P>::from_session(auth_context, provider_id, session)?;
        let res = self.provider.login(&mut ctx, req);
        ctx.commit()?;
        res
    }

    fn logout(
        &self,
        auth_context: &AuthContext,
        session: Session,
        provider_id: &str,
        req: &HttpRequest,
    ) -> Result<LogoutResponse, actix_web::Error> {
        let mut ctx = ProviderContext::<P>::from_session(auth_context, provider_id, session)?;
        let res = self.provider.logout(&mut ctx, req);
        ctx.commit()?;
        res
    }

    fn callback<'req>(
        &'req self,
        auth_context: &'req AuthContext,
        session: Session,
        provider_id: &'req str,
        req: HttpRequest,
    ) -> LocalBoxFuture<'req, Result<HttpResponse, actix_web::Error>> {
        Box::pin(async move {
            let mut ctx =
                ProviderContext::<P>::from_session(auth_context, provider_id, session.clone())?;
            let res = self.provider.callback(&mut ctx, req).await;
            ctx.commit()?;
            res
        })
    }
}
