mod infra;
mod track_section_layer;

pub use infra::Infra;
pub use track_section_layer::TrackSectionLayer;

use rocket_sync_db_pools::database;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
