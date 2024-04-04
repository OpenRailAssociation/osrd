use std::sync::{atomic::Ordering, Arc};
use tokio::sync::Mutex;
use tracing::warn;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::drivers::core_driver::CoreMetadata;

mod api;
mod config;
mod control_loop;
mod drivers;

#[tokio::main]
async fn main() {
    // Initialize tracing (logging in our case, can be extended to report to a service later)
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                if cfg!(debug_assertions) {
                    // Development build
                    "osrd_core_controller=trace,tower_http=debug,axum::rejection=trace"
                } else {
                    // Default on release build
                    "osrd_core_controller=warn,tower_http=info,axum::rejection=warn"
                }
                .into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = config::load().expect("Cannot load configuration");

    // Create the control loop, will load configuration
    let known_cores: Arc<Mutex<Vec<CoreMetadata>>> = Arc::new(Mutex::new(vec![]));
    let control_loop = control_loop::ControlLoop::new(config.clone(), known_cores.clone()).await;

    // Create the api server
    let api_server = tokio::spawn(api::create_server(
        config.api_listen_addr,
        known_cores.clone(),
    ));

    // Catching SIGINT (Ctrl+C)
    let should_continue_clone = control_loop.should_continue.clone();
    let sig_int_handler = async move {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
            .expect("Failed to install SIGINT handler")
            .recv()
            .await;
        warn!("Received SIGINT, shutting down...");
        should_continue_clone.store(false, Ordering::SeqCst);
    };

    // Catching SIGTERM
    let should_continue_clone = control_loop.should_continue.clone();
    let sig_term_handler = async move {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
        warn!("Received SIGTERM, shutting down...");
        should_continue_clone.store(false, Ordering::SeqCst);
    };

    // Run the control loop, the api server, and wait for a signal
    tokio::select! {
        _ = control_loop.run() => {},
        _ = api_server => {},
        _ = sig_int_handler => {},
        _ = sig_term_handler => {},
    }
}
