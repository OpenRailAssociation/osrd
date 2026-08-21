use crate::views::AuthorizationError;
use authz::Error;
use authz::v2::Authorizer;
use authz::v2::Protected;

/// Ensures the issuer holds a privilege satisfying `required`.
/// `protected` is an operation yielding the set of privileges the issuer holds on a resource.
/// Access is granted when the operation is authorized and the issuer holds a privilege equal to `required`.
pub async fn require<I, U>(
    authorizer: &U,
    protected: Protected<I>,
    required: &<I as IntoIterator>::Item,
) -> Result<(), AuthorizationError>
where
    I: IntoIterator,
    <I as IntoIterator>::Item: PartialEq,
    U: Authorizer<Error = Error>,
{
    let access = authorizer
        .authorize(protected)
        .await
        .map_err(|e| AuthorizationError::from(e.0))?;
    let Ok(privileges) = access.access().await? else {
        return Err(AuthorizationError::Forbidden);
    };
    if privileges
        .into_iter()
        .any(|privilege| privilege == *required)
    {
        Ok(())
    } else {
        Err(AuthorizationError::Forbidden)
    }
}
