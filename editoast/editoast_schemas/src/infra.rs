mod applicable_directions;
mod applicable_directions_track_range;
mod buffer_stop;
mod curve;
mod detector;
mod direction;
mod directional_track_range;
mod electrical_profiles;
mod electrification;
mod endpoint;
mod loading_gauge_limit;
mod neutral_section;
mod operational_point;
mod railjson;
mod route;
mod side;
mod sign;
mod signal;
mod slope;
mod speed_section;
mod switch;
mod switch_type;
mod track_endpoint;
mod track_location;
mod track_offset;
mod track_range;
mod track_section;
mod track_section_extensions;
mod track_section_sncf_extension;
mod track_section_source_extension;
mod waypoint;

pub use applicable_directions::ApplicableDirections;
pub use applicable_directions_track_range::ApplicableDirectionsTrackRange;
pub use buffer_stop::BufferStop;
pub use buffer_stop::BufferStopExtension;
pub use curve::Curve;
pub use detector::Detector;
pub use direction::Direction;
pub use directional_track_range::DirectionalTrackRange;
pub use electrical_profiles::ElectricalProfile;
pub use electrical_profiles::ElectricalProfileSetData;
pub use electrical_profiles::LevelValues;
pub use electrification::Electrification;
pub use endpoint::Endpoint;
pub use loading_gauge_limit::LoadingGaugeLimit;
pub use neutral_section::NeutralSection;
pub use operational_point::OperationalPoint;
pub use operational_point::OperationalPointExtensions;
pub use operational_point::OperationalPointIdentifierExtension;
pub use operational_point::OperationalPointPart;
pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use route::Route;
pub use route::RoutePath;
pub use side::Side;
pub use sign::Sign;
pub use signal::LogicalSignal;
pub use signal::Signal;
pub use signal::SignalExtensions;
pub use signal::SignalSncfExtension;
pub use slope::Slope;
pub use speed_section::Speed;
pub use speed_section::SpeedSection;
pub use switch::Switch;
pub use switch_type::builtin_node_types_list;
pub use switch_type::Crossing;
pub use switch_type::DoubleSlipSwitch;
pub use switch_type::Link;
pub use switch_type::PointSwitch;
pub use switch_type::SingleSlipSwitch;
pub use switch_type::SwitchPortConnection;
pub use switch_type::SwitchType;
pub use track_endpoint::TrackEndpoint;
pub use track_location::TrackLocation;
pub use track_offset::TrackOffset;
pub use track_range::TrackRange;
pub use track_section::TrackSection;
pub use track_section_extensions::TrackSectionExtensions;
pub use track_section_sncf_extension::TrackSectionSncfExtension;
pub use track_section_source_extension::TrackSectionSourceExtension;
pub use waypoint::Waypoint;

editoast_common::schemas! {
    applicable_directions::schemas(),
    applicable_directions_track_range::schemas(),
    buffer_stop::schemas(),
    detector::schemas(),
    directional_track_range::schemas(),
    direction::schemas(),
    electrical_profiles::schemas(),
    electrification::schemas(),
    endpoint::schemas(),
    loading_gauge_limit::schemas(),
    neutral_section::schemas(),
    operational_point::schemas(),
    route::schemas(),
    side::schemas(),
    signal::schemas(),
    sign::schemas(),
    speed_section::schemas(),
    switch::schemas(),
    switch_type::schemas(),
    track_endpoint::schemas(),
    track_location::schemas(),
    track_offset::schemas(),
    track_section::schemas(),
    railjson::schemas(),
}
