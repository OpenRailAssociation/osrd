/// Editoast authentication states
///
/// Represents all valid user states for editoast interactions. The values are
/// mostly extracted from request headers, but this module is axum-agnostic in order
/// to be able to reuse it in other contexts, such as the CLI.
///
/// The values are **not validated by the builder**.
#[derive(Debug, Clone)]
#[expect(unused)]
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
        identity: Option<String>,
        name: Option<String>,
    },
}

impl Authentication {
    pub fn builder() -> AuthenticationBuilder {
        AuthenticationBuilder::default()
    }
}

#[derive(Default)]
pub struct AuthenticationBuilder {
    identity: Option<String>,
    name: Option<String>,
    impersonate: Option<String>,
    skip: bool,
}

impl AuthenticationBuilder {
    pub fn identity(mut self, identity: Option<String>) -> Self {
        self.identity = identity;
        self
    }

    pub fn name(mut self, name: Option<String>) -> Self {
        self.name = name;
        self
    }

    pub fn impersonate(mut self, identity: Option<String>) -> Self {
        self.impersonate = identity;
        self
    }

    pub fn skip(mut self, skip: bool) -> Self {
        self.skip = skip;
        self
    }

    pub fn build(self) -> Result<Authentication, ()> {
        let authn = match self {
            Self {
                skip: true,
                identity,
                name,
                ..
            } => Authentication::Skip { identity, name },
            Self {
                impersonate: Some(impersonated_identity),
                identity: Some(impersonator_identity),
                name: Some(impersonator_name),
                ..
            } => Authentication::Impersonating {
                impersonator_identity,
                impersonator_name,
                impersonated_identity,
            },
            Self {
                identity: Some(identity),
                name: Some(name),
                ..
            } => Authentication::Authenticated { identity, name },
            Self {
                identity: None,
                name: None,
                impersonate: None,
                ..
            } => Authentication::Unauthenticated,
            _ => return Err(()),
        };
        Ok(authn)
    }
}
