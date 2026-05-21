use authz::Authorizer;
use authz::Role;
use authz::StorageDriver as _;
use authz::identity::UserInfo;
use authz::v2::special_authorizers;
use axum::Extension;
use axum::extract::Request;
use axum::extract::State;
use axum::middleware::Next;
use axum::response::Response;
use editoast_models::authn::user::AddIdentitiesError;

use crate::AppState;
use crate::authentication::AuthenticationParameters;
use crate::error::Result;
use crate::views::Authentication;
use crate::views::AuthorizationError;
use crate::views::AuthorizerError;
use crate::views::Regulator;

#[tracing::instrument(skip_all, fields(authn))]
pub(in crate::views) async fn authentication_extraction_middleware(
    State(AppState { config, .. }): State<AppState>,
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

    let authn = crate::authentication::Authentication::try_new(AuthenticationParameters {
        identity,
        name,
        impersonate,
        skip: skip_authz,
        authorization_enabled: config.enable_authorization,
    })
    .map_err(
        |AuthenticationParameters {
             identity,
             name,
             impersonate,
             skip,
             authorization_enabled,
         }| {
            tracing::error!(
                identity,
                name,
                impersonate,
                skip,
                authorization_enabled,
                "invalid authentication parameters"
            );
            AuthorizationError::Unauthorized
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
#[tracing::instrument(skip_all, fields(user.id, user.name, user.roles))]
pub(in crate::views) async fn authentication_validation_middleware(
    Extension(authn): Extension<crate::authentication::Authentication>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let is_impersonation = matches!(
        authn,
        crate::authentication::Authentication::Impersonating { .. }
    );

    fn origin_user(
        user: Option<editoast_models::User>,
        identity: &str,
        header_name: &str,
    ) -> Option<(editoast_models::User, ::authz::v2::Protected<Vec<Role>>)> {
        user.inspect(|user| {
            if user.name != header_name {
                tracing::warn!(
                    identity,
                    header = header_name,
                    stored = user.name,
                    "provided name for identity differ from stored",
                );
            }
        })
        .map(|user| {
            let authz_user = ::authz::Subject::user(user.id);
            (user, ::authz::v2::subject_roles(authz_user))
        })
    }

    async fn register_origin_user(
        conn: database::DbConnection,
        (identity, name): (&str, &str),
    ) -> Result<(
        Option<editoast_models::User>,
        ::authz::v2::Protected<Vec<Role>>,
    )> {
        tracing::info!(identity, name, "registering new user");
        let user = match editoast_models::User::register(
            conn,
            vec![identity.to_owned()],
            name.to_owned(),
        )
        .await
        {
            Ok(user) => user,
            Err(AddIdentitiesError::DuplicateIdentity(_)) => {
                unreachable!(
                    "the current function is only called when the user don't exists, and the `.register()`\n\
                    operation above only creates the user with one unique identity"
                );
            }
            Err(AddIdentitiesError::Error(err)) => return Err(err.into()),
        };
        let authz_user = ::authz::Subject::user(user.id);
        Ok((Some(user), ::authz::v2::subject_roles(authz_user)))
    }

    let (user, roles_prot) = if let Some(req_origin) = authn.origin() {
        let conn = db_pool.get().await?;
        conn.transaction(async |conn| {
            let origin = match &authn {
                crate::authentication::Authentication::Authenticated { identity, name } => {
                    let user =
                        editoast_models::User::retrieve_by_identity(identity, conn.clone()).await?;
                    origin_user(user, identity, name)
                }
                crate::authentication::Authentication::Impersonating {
                    impersonator_identity,
                    impersonator_name,
                    impersonated_identity,
                } => {
                    let (impersonator, impersonated) = tokio::try_join!(
                        // The batching API is annoying, that's the best I can do concisely for now. We should
                        // work on the DB user management that got worse since we added multiple identities support.
                        editoast_models::User::retrieve_by_identity(
                            impersonator_identity,
                            conn.clone()
                        ),
                        editoast_models::User::retrieve_by_identity(
                            impersonated_identity,
                            conn.clone()
                        )
                    )?;
                    if impersonated.is_none() {
                        return Err::<_, crate::error::InternalError>(
                            AuthorizationError::ImpersonatedUserNotFound {
                                identity: impersonated_identity.to_owned(),
                            }
                            .into(),
                        );
                    }
                    origin_user(impersonator, impersonator_identity, impersonator_name)
                }
                crate::authentication::Authentication::Unauthenticated
                | crate::authentication::Authentication::Skip { .. } => None,
            };

            Ok(match origin {
                Some((user, roles_prot)) => (Some(user), roles_prot),
                None => register_origin_user(conn, req_origin).await?,
            })
        })
        .await?
    } else {
        (None, ::authz::v2::Protected::default())
    };

    // A failed OpenFGA request does not invalidate the creation of a new user
    let openfga = regulator.openfga(); // to remove once OpenFGA is in the AppState directly
    let roles = special_authorizers::Authorize(openfga)
        .access_value(roles_prot)
        .await
        .map_err(AuthorizationError::from)?;

    if is_impersonation {
        if !roles.contains(&Role::Admin) {
            return Err(AuthorizationError::ForbiddenImpersonation.into());
        } else {
            tracing::info!("impersonation enabled");
        }
    }

    let span = tracing::Span::current();
    if let Some(user) = &user {
        span.record("user.id", user.id);
        span.record("user.name", tracing::field::display(&user.name));
    }
    span.record("user.roles", tracing::field::debug(&roles));
    span.record("user.is_admin", roles.contains(&Role::Admin));

    let user_id = user.as_ref().map(|editoast_models::User { id, .. }| *id);
    req.extensions_mut().insert(roles);
    // for `fga` queries and `authz` interface
    req.extensions_mut().insert(user_id.map(::authz::User));
    // database model, also carries the user name
    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

pub type AuthenticationExt = axum::extract::Extension<Authentication>;

async fn authenticate(
    enable_authorization: bool,
    headers: &axum::http::HeaderMap,
    regulator: Regulator,
) -> Result<Authentication, AuthorizationError> {
    const IDENTITY: &str = "x-remote-user-identity";
    const NAME: &str = "x-remote-user-name";
    const SKIP_AUTHZ: &str = "x-osrd-skip-authz";
    const IMPERSONATE: &str = "x-impersonate";

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

    let (user, identity) = match (identity, name) {
        (identity, name) if !enable_authorization => {
            tracing::debug!(
                identity,
                name,
                "authorization disabled — all role and permission checks are bypassed"
            );
            return Ok(Authentication::SkipAuthorization { identity, name });
        }
        (identity, name) if skip_authz => {
            tracing::debug!(identity, name, "authorization skipped by request");
            return Ok(Authentication::SkipAuthorization { identity, name });
        }
        (None, _) => return Ok(Authentication::Unauthenticated),
        (Some(identity), name) => (
            UserInfo {
                identities: vec![identity.clone()],
                name: name.unwrap_or_default(),
            },
            identity,
        ),
    };

    let authorizer = match Authorizer::try_initialize(identity.clone(), regulator.clone()).await {
        Ok(authorizer) => authorizer,
        Err(AuthorizerError::UnknownUser { .. }) => {
            // The user is not in the database, let's add it
            #[allow(deprecated)] // soon to be removed
            regulator
                .clone()
                .driver()
                .ensure_user(&user.name, &user.identities[0])
                .await
                .map_err(AuthorizerError::Storage)?;
            Authorizer::try_initialize(identity, regulator.clone()).await?
        }
        Err(err) => return Err(err.into()),
    };

    let Some(impersonated_identity) = impersonate else {
        return Ok(Authentication::Authenticated(authorizer));
    };

    // The user is trying to impersonate another user
    if !authorizer.check_roles([Role::Admin].into()).await? {
        return Err(AuthorizationError::ForbiddenImpersonation);
    }

    let impersonated_authorizer =
        match Authorizer::try_initialize(impersonated_identity.clone(), regulator).await {
            Ok(authorizer) => authorizer,
            Err(AuthorizerError::UnknownUser { .. }) => {
                return Err(AuthorizationError::ImpersonatedUserNotFound {
                    identity: impersonated_identity,
                });
            }
            err => err?,
        };
    Ok(Authentication::Authenticated(impersonated_authorizer))
}

pub(in crate::views) async fn authentication_middleware(
    State(AppState {
        regulator, config, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let headers = req.headers();
    let authorizer = authenticate(config.enable_authorization, headers, regulator).await?;
    req.extensions_mut().insert(authorizer);
    Ok(next.run(req).await)
}
