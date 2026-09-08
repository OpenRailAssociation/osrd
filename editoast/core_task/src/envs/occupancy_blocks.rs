use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher as _;
use std::sync::Arc;

use crate::Task;
use core_client::AsCoreRequest as _;
use core_client::CoreClient;

// ========== Core requests ==========
impl<'a> Task for core_client::signal_projection::SignalUpdatesRequest<'a> {
    type Output = core_client::signal_projection::SignalUpdatesResponse;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    // Please adjust if you have more educated information (and adjust the comment 😉).
    const CACHE_READS_BATCH_SIZE: usize = 50; // This value has been chosen this way: 🫳🎩

    fn key(&self, app_version: &str) -> String {
        let mut hasher = DefaultHasher::new();
        for train_simulation in &self.train_simulations {
            train_simulation.signal_critical_positions.hash(&mut hasher);
            train_simulation.zone_updates.hash(&mut hasher);
        }
        self.path.hash(&mut hasher);
        let req_hash = hasher.finish().to_string();
        format!("editoast.{app_version}.signal_updates.{req_hash}")
    }

    async fn compute(self, ctx: Self::Context) -> Result<Self::Output, Self::Error> {
        self.fetch(ctx.as_ref()).await
    }
}
