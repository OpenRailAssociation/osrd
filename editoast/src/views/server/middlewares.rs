use std::convert::Infallible;

use authz::Role;
use authz::SystemAuthorizer;
use authz::v2::special_authorizers;
use axum::Extension;
use axum::extract::Request;
use axum::extract::State;
use axum::middleware::Next;
use axum::response::Response;
use models::authn::user::AddIdentitiesError;
use tracing::Instrument;

use crate::AppState;
use crate::authentication::AuthenticationParameters;
use crate::error::Result;
use crate::views::AuthorizationError;

#[tracing::instrument(skip_all, fields(authn))]
pub(in crate::views) async fn authentication_extraction_middleware(
    State(AppState { .. }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    const IDENTITY: &str = "x-remote-user-identity";
    const NAME: &str = "x-remote-user-name";
    const SKIP_AUTHZ: &str = "x-osrd-skip-authz";
    const IMPERSONATE: &str = "x-impersonate";

    let headers = req.headers();
    let identity = headers.get(IDENTITY).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-identity")
            .to_owned()
    });
    let name = headers.get(NAME).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-name")
            .to_owned()
    });
    let impersonate = headers.get(IMPERSONATE).map(|hv| {
        str::from_utf8(hv.as_bytes())
            .expect("unexpected non-utf8 characters in x-impersonate")
            .to_owned()
    });
    let skip_authz = headers.contains_key(SKIP_AUTHZ);

    let authn = crate::authentication::Mode::try_new(AuthenticationParameters {
        identity,
        name,
        impersonate,
        skip: skip_authz,
    })
    .map_err(
        |AuthenticationParameters {
             identity,
             name,
             impersonate,
             skip,
         }| {
            tracing::error!(
                identity,
                name,
                impersonate,
                skip,
                "invalid authentication parameters"
            );
            AuthorizationError::Unauthenticated
        },
    )?;

    tracing::info!(?authn, "authentication complete");
    tracing::Span::current().record("authn", tracing::field::debug(&authn));
    req.extensions_mut().insert(authn);
    Ok(next.run(req).await)
}

/// Takes an authenticated request and performs a few verifications
///
/// - the origin user exists in the database, if not we create it
/// - the impersonator must be an admin
/// - the impersonated user must already exist in the database, we do not create it if it does not
/// - push the roles of the origin user in the request extensions
#[tracing::instrument(skip_all, fields(user.id, user.name, user.roles, authz.state))]
pub(in crate::views) async fn authentication_validation_middleware(
    Extension(authn): Extension<crate::authentication::Mode>,
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    fn warn_on_name_mismatch(user: &models::User, identity: &str, header_name: &str) {
        if user.name != header_name {
            tracing::warn!(
                identity,
                header = header_name,
                stored = &user.name,
                "provided name for identity differ from stored",
            );
        }
    }

    fn zip_roles(user: models::User) -> (Option<models::User>, ::authz::v2::Protected<Vec<Role>>) {
        let subject = ::authz::Subject::user(user.id);
        (Some(user), ::authz::v2::subject_roles(subject))
    }

    async fn register_origin_user(
        conn: database::DbConnection,
        (identity, name): (&str, &str),
    ) -> Result<(Option<models::User>, ::authz::v2::Protected<Vec<Role>>)> {
        tracing::info!(identity, name, "registering new user");
        let user = match models::User::register(conn, vec![identity.to_owned()], name.to_owned())
            .await
        {
            Ok(user) => user,
            Err(AddIdentitiesError::DuplicateIdentity(_)) => {
                unreachable!(
                    "the current function is only called when the user doesn't exists, and the `.register()`\n\
                    operation above only creates the user with one unique identity"
                );
            }
            Err(AddIdentitiesError::Error(err)) => return Err(err.into()),
        };
        Ok((Some(user), ::authz::v2::Protected::default())) // new users cannot have roles
    }

    async fn check_impersonation_privilege(
        openfga: &fga::Client,
        user: &models::User,
    ) -> Result<()> {
        let Ok(roles) = ::authz::v2::subject_roles(::authz::Subject::user(user.id))
            .authorize(&SystemAuthorizer::<Infallible>::new(openfga))
            .await?
            .access()
            .await?;
        if roles.contains(&Role::Admin) {
            Ok(())
        } else {
            Err(AuthorizationError::ForbiddenImpersonation.into())
        }
    }

    let (user, roles_prot) = match &authn {
        crate::authentication::Mode::Authenticated { identity, name } => {
            let conn = db_pool.get().await?;
            conn.transaction(async |conn| {
                let user = models::User::retrieve_by_identity(identity, conn.clone()).await?;
                Ok::<_, crate::error::InternalError>(if let Some(user) = user {
                    warn_on_name_mismatch(&user, identity, name);
                    zip_roles(user)
                } else {
                    register_origin_user(conn.clone(), (identity, name)).await?
                })
            })
            .await?
        }
        crate::authentication::Mode::Impersonating {
            impersonator_identity,
            impersonator_name,
            impersonated_identity,
        } => {
            let conn = db_pool.get().await?;
            conn.transaction(async |conn| {
                let (impersonator, impersonated) = tokio::try_join!(
                    // The batching API is annoying, that's the best I can do concisely for now. We should
                    // work on the DB user management that got worse since we added multiple identities support.
                    models::User::retrieve_by_identity(impersonator_identity, conn.clone()),
                    models::User::retrieve_by_identity(impersonated_identity, conn.clone())
                )?;
                if let Some(impersonator) = impersonator {
                    warn_on_name_mismatch(&impersonator, impersonator_identity, impersonator_name);
                    check_impersonation_privilege(&openfga, &impersonator).await?;
                } else {
                    // a new user cannot have Admin role
                    return Err(AuthorizationError::ForbiddenImpersonation.into());
                }
                if let Some(impersonated) = impersonated {
                    Ok(zip_roles(impersonated))
                } else {
                    Err::<_, crate::error::InternalError>(
                        AuthorizationError::ImpersonatedUserNotFound {
                            identity: impersonated_identity.to_owned(),
                        }
                        .into(),
                    )
                }
            })
            .await?
        }
        crate::authentication::Mode::Skip => (None, ::authz::v2::Protected::default()),
        crate::authentication::Mode::Unauthenticated => {
            return Err(AuthorizationError::Unauthenticated.into());
        }
    };

    // A failed OpenFGA request does not invalidate the creation of a new user
    let openfga = &openfga; // to remove once OpenFGA is in the AppState directly
    let roles = special_authorizers::Authorize(openfga)
        .access_value(roles_prot)
        .await
        .map_err(AuthorizationError::from)?;

    let span = tracing::Span::current();
    if let Some(user) = &user {
        span.record("user.id", user.id);
        span.record("user.name", tracing::field::display(&user.name));
    }
    span.record("user.roles", tracing::field::debug(&roles));
    span.record("user.is_admin", roles.contains(&Role::Admin));

    let authz_user = user
        .as_ref()
        .map(|models::User { id, .. }| ::authz::User(*id));
    let state = crate::authentication::State::try_new(authn, authz_user, roles.clone())?;
    span.record("authz.state", tracing::field::debug(&state));
    req.extensions_mut().insert(state);
    req.extensions_mut().insert(user);
    req.extensions_mut().remove::<crate::authentication::Mode>();
    Ok(next.run(req).await)
}

pub(in crate::views) async fn handler_span_middleware(req: Request, next: Next) -> Response {
    let span = tracing::info_span!(
        "handler",
        method = %req.method(),
        uri = %req.uri().path(),
        // Change the OpenTelemetry span name to improve timeline legibility.
        otel.name = format!("{} {}", req.method(), req.uri().path()),
    );
    next.run(req).instrument(span).await
}
