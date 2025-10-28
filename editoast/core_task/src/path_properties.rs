use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher as _;
use std::sync::Arc;

use core_client::AsCoreRequest;
use core_client::CoreClient;

use crate::Task;

impl<'a> Task for core_client::path_properties::PathPropertiesRequest<'a> {
    type Output = core_client::path_properties::PathPropertiesResponse;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    const CACHE_READS_BATCH_SIZE: usize = 100; // adjust if needed

    fn key(&self, app_version: &str) -> String {
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        let req_hash = hasher.finish().to_string();
        format!("editoast.{app_version}.path_properties.{req_hash}")
    }

    async fn compute(self, ctx: Self::Context) -> Result<Self::Output, Self::Error> {
        self.fetch(&ctx).await
    }
}
