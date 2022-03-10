mod infra;
mod signal_layer;
mod track_section_layer;

pub use infra::Infra;
pub use signal_layer::SignalLayer;
pub use track_section_layer::TrackSectionLayer;

use rocket_sync_db_pools::database;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
