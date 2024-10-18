pub mod docker;
pub mod kubernetes;
pub mod noop;
pub mod process_compose;
pub mod worker_driver;

const LABEL_MANAGED_BY: &str = "osrd/managed_by";
const LABEL_WORKER_ID: &str = "osrd/worker_id";
const LABEL_WORKER_KEY: &str = "osrd/worker_key";
const LABEL_VERSION_IDENTIFIER: &str = "osrd/version_identifier";
const LABEL_QUEUE_NAME: &str = "osrd/queue_name";

const MANAGED_BY_VALUE: &str = "osrdyne";
