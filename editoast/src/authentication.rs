use authz::Role;
use authz::v2::Check;

use crate::authorizers::SystemAuthorizer;
use crate::authorizers::UserAuthorizer;
use crate::views::AuthorizationError;

/// Editoast authentication states
///
/// Represents all valid user states for editoast interactions. The values are
/// mostly extracted from request headers, but this module is axum-agnostic in order
/// to be able to reuse it in other contexts, such as the CLI.
///
/// The values are **not validated by the builder**.
#[derive(Debug, Clone)]
pub enum Mode {
    Unauthenticated,
    Authenticated {
        identity: String,
        name: String,
    },
    Impersonating {
        impersonator_identity: String,
        impersonator_name: String,
        impersonated_identity: String,
    },
    Skip,
}

#[derive(Debug, Default)]
pub struct AuthenticationParameters {
    pub identity: Option<String>,
    pub name: Option<String>,
    pub impersonate: Option<String>,
    pub skip: bool,
}

impl Mode {
    #[tracing::instrument(name = "authentication request")]
    pub fn try_new(params: AuthenticationParameters) -> Result<Self, AuthenticationParameters> {
        let authn = match params {
            AuthenticationParameters {
                skip: true,
                identity: None,
                name: None,
                impersonate: None,
            } => Self::Skip,
            AuthenticationParameters { skip: true, .. } => return Err(params),
            AuthenticationParameters {
                impersonate: Some(impersonated_identity),
                identity: Some(impersonator_identity),
                name: Some(impersonator_name),
                ..
            } => Self::Impersonating {
                impersonator_identity,
                impersonator_name,
                impersonated_identity,
            },
            AuthenticationParameters {
                identity: Some(identity),
                name: Some(name),
                ..
            } => Self::Authenticated { identity, name },
            AuthenticationParameters {
                identity: None,
                name: None,
                impersonate: None,
                ..
            } => Self::Unauthenticated,
            params => return Err(params),
        };
        Ok(authn)
    }
}

#[derive(Debug, Clone)]
pub enum State {
    Skip,
    Authenticated { user: authz::User, roles: Vec<Role> },
}

impl State {
    /// The authenticated user if authorization is **not** skipped
    ///
    /// If this function returns a user, then it is subject to permissions,
    /// otherwise they likely can be bypassed.
    pub fn regular_user(&self) -> Option<authz::User> {
        match self {
            State::Skip => None,
            State::Authenticated { user, .. } => Some(*user),
        }
    }

    pub fn roles(&self) -> &[Role] {
        static EMPTY_ROLES: [Role; 0] = [];
        match self {
            State::Skip => &EMPTY_ROLES,
            State::Authenticated { roles, .. } => roles,
        }
    }

    pub fn authorizer<'a>(
        &self,
        openfga: &'a fga::Client,
    ) -> itertools::Either<UserAuthorizer<'a>, SystemAuthorizer<'a, Check>> {
        match self {
            State::Authenticated { user, roles } => {
                itertools::Either::Left(UserAuthorizer::new(*user, roles.clone(), openfga))
            }
            State::Skip => itertools::Either::Right(SystemAuthorizer::new(openfga)),
        }
    }

    /// Builds the authentication [State] from a parsed [Mode] and the user already
    /// resolved by the middleware (DB querying happens there, not here).
    ///
    /// `user` is expected to be `Some` for [Mode::Authenticated] and
    /// [Mode::Impersonating] (in which case it is the impersonated user).
    pub fn try_new(
        mode: Mode,
        user: Option<authz::User>,
        roles: Vec<Role>,
    ) -> Result<Self, AuthorizationError> {
        match mode {
            Mode::Unauthenticated => Err(AuthorizationError::Unauthenticated),
            Mode::Authenticated { .. } | Mode::Impersonating { .. } => {
                let user = user.expect("providing the request user is required when Mode::Authenticated or Mode::Impersonating");
                Ok(State::Authenticated { user, roles })
            }
            Mode::Skip => Ok(State::Skip),
        }
    }
}
