pub mod docker;
pub mod kubernetes;
pub mod noop;
pub mod worker_driver;

const LABEL_MANAGED_BY: &str = "osrd/managed_by";
const LABEL_WORKER_ID: &str = "osrd/worker_id";
const LABEL_WORKER_KEY: &str = "osrd/worker_key";

const MANAGED_BY_VALUE: &str = "osrdyne";
