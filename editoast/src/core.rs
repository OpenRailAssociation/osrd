pub mod client;
pub mod conflict_detection;
pub mod error;
pub mod infra_loading;
#[cfg(test)]
pub mod mocking;
pub mod mq_client;
pub mod path_properties;
pub mod pathfinding;
pub mod signal_projection;
pub mod simulation;
pub mod stdcm;
pub mod version;

pub use client::CoreClient;
pub use error::CoreError;
pub use mq_client::RabbitMQClient;

editoast_common::schemas! {
    simulation::schemas(),
    pathfinding::schemas(),
    conflict_detection::schemas(),
    stdcm::schemas(),
    error::schemas(),
}
