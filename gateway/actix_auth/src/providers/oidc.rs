use actix_web::http::header::{self, LanguageTag, Preference};
use actix_web::{http::StatusCode, web, FromRequest, HttpRequest, HttpResponse};
use futures_util::future::LocalBoxFuture;
use log::error;
use openidconnect::core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata};
use openidconnect::reqwest::async_http_client;
use openidconnect::{
    AccessTokenHash, AuthorizationCode, ClientId, ClientSecret, CsrfToken, DiscoveryError,
    IssuerUrl, LocalizedClaim, Nonce, OAuth2TokenResponse, RedirectUrl, Scope, TokenResponse,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::{
    LoginResponse, LogoutResponse, ProviderContext, ProviderSessionStatus, SessionProvider,
};

pub struct OidcConfig {
    pub issuer_url: Box<IssuerUrl>,
    pub post_login_url: Box<url::Url>,
    pub callback_url: Box<RedirectUrl>,
    pub client_id: ClientId,
    pub client_secret: Option<ClientSecret>,
}

impl OidcConfig {
    pub fn new(
        issuer_url: Box<IssuerUrl>,
        post_login_url: Box<url::Url>,
        callback_url: Box<RedirectUrl>,
        client_id: String,
        client_secret: String,
    ) -> Self {
        Self {
            issuer_url,
            post_login_url,
            callback_url,
            client_id: ClientId::new(client_id),
            client_secret: Some(ClientSecret::new(client_secret)),
        }
    }
}

#[derive(Clone)]
pub struct OidcProvider {
    pub client: Box<CoreClient>,
    pub post_login_url: Box<url::Url>,
}

impl OidcProvider {
    pub async fn from_config(
        config: &OidcConfig,
    ) -> Result<Self, DiscoveryError<openidconnect::reqwest::Error<reqwest::Error>>> {
        // Use OpenID Connect Discovery to fetch the provider metadata.
        let provider_metadata =
            CoreProviderMetadata::discover_async(*config.issuer_url.clone(), async_http_client)
                .await?;

        let client = Box::new(
            CoreClient::from_provider_metadata(
                provider_metadata,
                config.client_id.clone(),
                config.client_secret.clone(),
            )
            // Set the URL the user will be redirected to after the authorization process.
            .set_redirect_uri(*config.callback_url.clone()),
        );

        Ok(Self {
            client,
            post_login_url: config.post_login_url.clone(),
        })
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum OidcSessionState {
    Callback { csrf_token: CsrfToken, nonce: Nonce },
    LoggedIn { id: String, username: String },
}

impl SessionProvider for OidcProvider {
    type SessionState = OidcSessionState;

    fn backend_id() -> &'static str {
        "oidc"
    }

    fn get_session(
        &self,
        ctx: &mut ProviderContext<Self>,
        _: &HttpRequest,
    ) -> ProviderSessionStatus {
        match ctx.state() {
            None => ProviderSessionStatus::LoggedOut,
            Some(OidcSessionState::Callback { .. }) => ProviderSessionStatus::LoggedOut,
            Some(OidcSessionState::LoggedIn { id, username }) => ProviderSessionStatus::LoggedIn {
                user_id: id.clone(),
                username: username.clone(),
            },
        }
    }

    fn login(
        &self,
        ctx: &mut ProviderContext<Self>,
        _: &HttpRequest,
    ) -> Result<LoginResponse, actix_web::Error> {
        // Generate the full authorization URL.
        let client_builder = self
            .client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .add_scope(Scope::new("profile".to_owned()));

        let (auth_url, csrf_token, nonce) = client_builder.url();
        // if we ever decide to store the nonce unencrypted, we should also change how it's checked:
        // https://openid.net/specs/openid-connect-core-1_0.html#NonceNotes
        ctx.set_state(OidcSessionState::Callback { csrf_token, nonce });
        Ok(LoginResponse::Redirect {
            url: auth_url.as_str().to_owned(),
        })
    }

    fn logout(
        &self,
        ctx: &mut ProviderContext<Self>,
        _: &HttpRequest,
    ) -> Result<LogoutResponse, actix_web::Error> {
        ctx.logout();
        Ok(LogoutResponse::Success)
    }

    /// Some session provider backends, such as OpenID connect, require additional interactions during the authentication flow
    fn callback<'req, 'ctx>(
        &'req self,
        ctx: &'ctx mut ProviderContext<'req, Self>,
        req: HttpRequest,
    ) -> LocalBoxFuture<'ctx, Result<HttpResponse, actix_web::Error>> {
        Box::pin(async move {
            let (client_csrf_token, nonce) = match ctx.state() {
                Some(OidcSessionState::Callback { csrf_token, nonce }) => (csrf_token, nonce),
                _ => return Err(CallbackError::InvalidSessionState.into()),
            };

            let info = web::Query::<CallbackParameters>::extract(&req).await?;

            // the CSRF token is passed as the Oauth2 "state"
            if &info.state != client_csrf_token.secret() {
                return Err(CallbackError::InvalidCSRF.into());
            }

            // Now you can exchange it for an access token and ID token.
            let token_response = self
                .client
                .exchange_code(AuthorizationCode::new(info.code.clone()))
                .request_async(async_http_client)
                .await
                .map_err(|err| {
                    error!("unable to exchange code: {err:?}");
                    CallbackError::CodeExchangeError
                })?;

            // Extract the ID token claims after verifying its authenticity and nonce.
            let id_token = token_response
                .id_token()
                .ok_or(CallbackError::MissingIDToken)?;
            let claims = id_token
                .claims(&self.client.id_token_verifier(), nonce)
                .map_err(|err| {
                    error!("unable to verify ID token signature: {err:?}");
                    CallbackError::InvalidIDTokenSignature
                })?;

            // Verify the access token hash to ensure that the access token hasn't been substituted for
            // another user's.
            if let Some(expected_access_token_hash) = claims.access_token_hash() {
                // this should never fail, as claims verification alreay validates the signing alg
                let signing_alg = &id_token
                    .signing_alg()
                    .expect("failed to get the signing alg");
                let actual_access_token_hash =
                    AccessTokenHash::from_token(token_response.access_token(), signing_alg)
                        .map_err(|_| CallbackError::InvalidAccessTokenSignature)?;
                if actual_access_token_hash != *expected_access_token_hash {
                    return Err(CallbackError::InvalidAccessTokenSignature.into());
                }
            }

            log::debug!("claims: {claims:?}");

            let accept_language = web::Header::<header::AcceptLanguage>::extract(&req).await;
            let language_prefs = accept_language.ok().map(|langs| langs.ranked());

            // the subject is a unique user identifier
            let subject = claims.subject().to_string();

            // the name is meant to be displayed
            let name = claims
                .name()
                .and_then(|claim_name| {
                    resolve_localized_claim(claim_name, language_prefs.as_deref())
                })
                .map(|claim_name| claim_name.to_string());

            log::info!("logging in the user: id={subject} name={name:?}");

            // if there's no name, use the subject as a placeholder
            let name = name.unwrap_or_else(|| subject.clone());

            ctx.login(OidcSessionState::LoggedIn {
                id: subject,
                username: name,
            });

            Ok(HttpResponse::Found()
                .append_header(("Location", self.post_login_url.as_str()))
                .finish())
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct CallbackParameters {
    code: String,
    state: String,
}

fn resolve_localized_claim<'a, T>(
    localized_claim: &'a LocalizedClaim<T>,
    language_prefs: Option<&[Preference<LanguageTag>]>,
) -> Option<&'a T> {
    let Some(language_prefs) = language_prefs else {
        return localized_claim.get(None);
    };

    for language_pref in language_prefs {
        let lang_claim = localized_claim.get(
            match language_pref {
                header::Preference::Any => None,
                header::Preference::Specific(lang) => {
                    Some(openidconnect::LanguageTag::new(lang.to_string()))
                }
            }
            .as_ref(),
        );
        if let Some(lang_claim) = lang_claim {
            return Some(lang_claim);
        }
    }
    localized_claim.get(None)
}

#[derive(Debug, Error)]
pub enum CallbackError {
    #[error("Invalid OIDC session state")]
    InvalidSessionState,
    #[error("invalid CSRF token")]
    InvalidCSRF,
    #[error("code exchange failed")]
    CodeExchangeError,
    #[error("missing ID token")]
    MissingIDToken,
    #[error("ID token signature verification failed")]
    InvalidIDTokenSignature,
    #[error("access token signature verification failed")]
    InvalidAccessTokenSignature,
}

impl actix_web::ResponseError for CallbackError {
    fn status_code(&self) -> StatusCode {
        match self {
            CallbackError::InvalidSessionState => StatusCode::BAD_REQUEST,
            CallbackError::InvalidCSRF => StatusCode::BAD_REQUEST,
            CallbackError::CodeExchangeError => StatusCode::INTERNAL_SERVER_ERROR,
            CallbackError::MissingIDToken => StatusCode::INTERNAL_SERVER_ERROR,
            CallbackError::InvalidIDTokenSignature => StatusCode::INTERNAL_SERVER_ERROR,
            CallbackError::InvalidAccessTokenSignature => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}
