/// Editoast authentication states
///
/// Represents all valid user states for editoast interactions. The values are
/// mostly extracted from request headers, but this module is axum-agnostic in order
/// to be able to reuse it in other contexts, such as the CLI.
///
/// The values are **not validated by the builder**.
#[derive(Debug, Clone)]
pub enum Authentication {
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
    Skip {
        #[expect(unused)]
        identity: Option<String>,
        #[expect(unused)]
        name: Option<String>,
    },
}

#[derive(Default)]
pub struct AuthenticationParameters {
    pub identity: Option<String>,
    pub name: Option<String>,
    pub impersonate: Option<String>,
    pub skip: bool,
    pub authorization_enabled: bool,
}

impl Authentication {
    pub fn try_new(params: AuthenticationParameters) -> Result<Self, AuthenticationParameters> {
        let authn = match params {
            AuthenticationParameters {
                skip: true,
                identity,
                name,
                ..
            }
            | AuthenticationParameters {
                authorization_enabled: false,
                identity,
                name,
                ..
            } => Self::Skip { identity, name },
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

    pub fn origin(&self) -> Option<(&str, &str)> {
        match self {
            Authentication::Authenticated { identity, name }
            | Authentication::Impersonating {
                impersonator_identity: identity,
                impersonator_name: name,
                impersonated_identity: _,
            } => Some((identity.as_str(), name.as_str())),
            Authentication::Unauthenticated | Authentication::Skip { .. } => None,
        }
    }
}
