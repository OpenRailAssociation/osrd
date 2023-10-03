use actix_session::{Session, SessionGetError, SessionInsertError};
use serde::{Deserialize, Serialize};

use crate::auth_context::AuthContext;

use super::SessionProvider;

/// Used to track whether session state changed
pub struct ChangeTracker<T> {
    value: T,
    changed: bool,
}

impl<T> ChangeTracker<T> {
    fn new(value: T) -> Self {
        Self {
            value,
            changed: false,
        }
    }

    fn set(&mut self, new_value: T) {
        self.value = new_value;
        self.changed = true;
    }

    fn get(&self) -> &T {
        &self.value
    }

    fn changed(&self) -> bool {
        self.changed
    }
}

pub struct ProviderContext<'req, P>
where
    P: SessionProvider,
    P::SessionState: Serialize + for<'de> Deserialize<'de> + Clone,
{
    provider_key: String,
    session: Session,
    session_state: ChangeTracker<Option<P::SessionState>>,
    auth_context: &'req AuthContext,
    provider_id: &'req str,
}

impl<'req, P> ProviderContext<'req, P>
where
    P: SessionProvider,
    P::SessionState: Serialize + for<'de> Deserialize<'de> + Clone,
{
    pub fn state(&self) -> Option<&P::SessionState> {
        self.session_state.get().as_ref()
    }

    /// Don't use this function to log out an user.
    pub fn set_state(&mut self, new: P::SessionState) {
        self.session_state.set(Some(new));
    }

    pub fn login(&mut self, new: P::SessionState) {
        self.set_state(new);
        self.auth_context
            .set_active_provider(&self.session, Some(self.provider_id));
    }

    pub fn logout(&mut self) {
        self.session_state.set(None);
        self.auth_context.set_active_provider(&self.session, None);
    }

    pub(crate) fn from_session(
        auth_context: &'req AuthContext,
        provider_id: &'req str,
        session: Session,
    ) -> Result<Self, SessionGetError> {
        let provider_key = auth_context.session_provider_key(provider_id);
        let session_state = ChangeTracker::new(session.get::<P::SessionState>(&provider_key)?);
        Ok(Self {
            provider_key,
            session,
            session_state,
            auth_context,
            provider_id,
        })
    }

    pub fn commit(self) -> Result<(), SessionInsertError> {
        if !self.session_state.changed() {
            return Ok(());
        }

        if let Some(new) = self.session_state.get() {
            self.session.insert(&self.provider_key, new)
        } else {
            self.session.remove(&self.provider_key);
            Ok(())
        }
    }
}
