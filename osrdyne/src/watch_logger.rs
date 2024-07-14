use log::info;
use std::fmt::Debug;
use tokio::sync::watch::Receiver;

pub async fn watch_logger<T: Debug>(prefix: String, mut rx: Receiver<T>) {
    loop {
        {
            let val = rx.borrow_and_update();
            info!("{}: {:?}", prefix, val);
        }
        if rx.changed().await.is_err() {
            info!("stopping sub actor");
            break;
        }
    }
}
