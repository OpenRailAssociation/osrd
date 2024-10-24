use std::fmt::Debug;
use tokio::sync::watch::Receiver;
use tracing::debug;

pub async fn watch_logger<T: Debug>(prefix: String, mut rx: Receiver<T>) {
    loop {
        {
            let val = rx.borrow_and_update();
            debug!(?val, "{}", prefix);
        }
        if rx.changed().await.is_err() {
            debug!("stopping sub actor");
            break;
        }
    }
}
