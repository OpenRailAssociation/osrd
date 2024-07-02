#![allow(clippy::duplicated_attributes)]

use chrono::NaiveDateTime;
use editoast_derive::Search;
use editoast_derive::SearchConfigStore;
use serde_derive::Serialize;
use utoipa::ToSchema;

use editoast_common::geometry::GeoJsonPoint;

// NOTE: every structure deriving `Search` here might have to `#[allow(unused)]`
// because while the name and type information of the fields are read by the macro,
// they might not be explicitly used in the code. (Their JSON representation extracted
// from the DB query is direcly forwarded into the endpoint response, so these
// structs are never deserialized, hence their "non-usage".)
//
// These structs also derive Serialize because utoipa reads some `#[serde(...)]`
// annotations to alter the schema. That's not ideal since none of them are ever
// serialized, but that's life.

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "track",
    table = "search_track",
    column(name = "infra_id", data_type = "INT"),
    column(name = "line_code", data_type = "INT"),
    column(name = "line_name", data_type = "TEXT")
)]
#[allow(unused)]
/// A search result item for a query with `object = "track"`
///
/// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::modelsv2::infra::Infra::clone]
pub(super) struct SearchResultItemTrack {
    #[search(sql = "search_track.infra_id")]
    infra_id: i64,
    #[search(sql = "search_track.unprocessed_line_name")]
    line_name: String,
    #[search(sql = "search_track.line_code")]
    line_code: i64,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "operationalpoint",
    table = "search_operational_point",
    migration(src_table = "infra_object_operational_point"),
    joins = "
        INNER JOIN infra_object_operational_point AS OP ON OP.id = search_operational_point.id
        INNER JOIN (SELECT DISTINCT ON (infra_id, obj_id) * FROM infra_layer_operational_point)
            AS lay ON OP.obj_id = lay.obj_id AND OP.infra_id = lay.infra_id",
    column(
        name = "obj_id",
        data_type = "varchar(255)",
        sql = "infra_object_operational_point.obj_id",
    ),
    column(
        name = "infra_id",
        data_type = "integer",
        sql = "infra_object_operational_point.infra_id",
    ),
    column(
        name = "uic",
        data_type = "integer",
        sql = "(infra_object_operational_point.data->'extensions'->'identifier'->>'uic')::integer",
    ),
    column(
        name = "trigram",
        data_type = "varchar(3)",
        sql = "infra_object_operational_point.data->'extensions'->'sncf'->>'trigram'",
    ),
    column(
        name = "ci",
        data_type = "integer",
        sql = "(infra_object_operational_point.data->'extensions'->'sncf'->>'ci')::integer",
    ),
    column(
        name = "ch",
        data_type = "text",
        sql = "infra_object_operational_point.data->'extensions'->'sncf'->>'ch'",
    ),
    column(
        name = "name",
        data_type = "text",
        sql = "infra_object_operational_point.data->'extensions'->'identifier'->>'name'",
        textual_search,
    )
)]
#[allow(unused)]
/// A search result item for a query with `object = "operationalpoint"`
///
/// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::modelsv2::infra::Infra::clone]
pub(super) struct SearchResultItemOperationalPoint {
    #[search(sql = "OP.obj_id")]
    obj_id: String,
    #[search(sql = "OP.infra_id")]
    infra_id: i64,
    #[search(sql = "OP.data->'extensions'->'identifier'->'uic'")]
    uic: i64,
    #[search(sql = "OP.data#>>'{extensions,identifier,name}'")]
    name: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,trigram}'")]
    trigram: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,ch}'")]
    ch: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,ci}'")]
    ci: u64,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: GeoJsonPoint,
    #[search(sql = "OP.data->'parts'")]
    #[schema(inline)]
    track_sections: Vec<SearchResultItemOperationalPointTrackSections>,
}
#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub(super) struct SearchResultItemOperationalPointTrackSections {
    track: String,
    position: f64,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "signal",
    table = "search_signal",
    migration(
        src_table = "infra_object_signal",
        query_joins = "
            INNER JOIN infra_object_track_section AS track_section
            ON track_section.infra_id = infra_object_signal.infra_id
                AND track_section.obj_id = infra_object_signal.data->>'track'",
    ),
    column(
        name = "label",
        data_type = "text",
        sql = "infra_object_signal.data->'extensions'->'sncf'->>'label'",
        textual_search
    ),
    column(
        name = "line_name",
        data_type = "text",
        sql = "track_section.data->'extensions'->'sncf'->>'line_name'",
        textual_search
    ),
    column(
        name = "infra_id",
        data_type = "integer",
        sql = "infra_object_signal.infra_id"
    ),
    column(
        name = "obj_id",
        data_type = "VARCHAR(255)",
        sql = "infra_object_signal.obj_id"
    ),
    column(
        name = "signaling_systems",
        data_type = "TEXT[]",
        sql = "ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].signaling_system')->>0)"
    ),
    column(
        name = "settings",
        data_type = "TEXT[]",
        sql = "ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].settings.keyvalue().key')->>0)"
    ),
    column(
        name = "line_code",
        data_type = "integer",
        sql = "(track_section.data->'extensions'->'sncf'->>'line_code')::integer"
    ),
    joins = "
        INNER JOIN infra_object_signal AS sig ON sig.id = search_signal.id
        INNER JOIN infra_object_track_section AS track_section ON track_section.obj_id = sig.data->>'track' AND track_section.infra_id = sig.infra_id
        INNER JOIN infra_layer_signal AS lay ON lay.infra_id = sig.infra_id AND lay.obj_id = sig.obj_id"
)]
#[allow(unused)]
/// A search result item for a query with `object = "signal"`
///
/// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::modelsv2::infra::Infra::clone]
pub(super) struct SearchResultItemSignal {
    #[search(sql = "sig.infra_id")]
    infra_id: i64,
    #[search(sql = "sig.data->'extensions'->'sncf'->>'label'")]
    label: String,
    #[search(sql = "search_signal.signaling_systems")]
    signaling_systems: Vec<String>,
    #[search(sql = "search_signal.settings")]
    settings: Vec<String>,
    #[search(sql = "search_signal.line_code")]
    line_code: u64,
    #[search(sql = "track_section.data->'extensions'->'sncf'->>'line_name'")]
    line_name: String,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: GeoJsonPoint,
    #[search(sql = "lay.signaling_system")]
    sprite_signaling_system: Option<String>,
    #[search(sql = "lay.sprite")]
    sprite: Option<String>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "project",
    table = "search_project",
    joins = "INNER JOIN project ON project.id = search_project.id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string")
)]
#[allow(unused)]
/// A search result item for a query with `object = "project"`
pub(super) struct SearchResultItemProject {
    #[search(sql = "project.id")]
    id: u64,
    #[search(sql = "project.image_id")]
    #[schema(required)]
    image: Option<u64>,
    #[search(sql = "project.name")]
    name: String,
    #[search(
        sql = "(SELECT COUNT(study.id) FROM study WHERE search_project.id = study.project_id)"
    )]
    studies_count: u64,
    #[search(sql = "project.description")]
    description: String,
    #[search(sql = "project.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "project.tags")]
    tags: Vec<String>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "study",
    table = "search_study",
    migration(src_table = "study"),
    joins = "INNER JOIN study ON study.id = search_study.id",
    column(name = "name", data_type = "TEXT", sql = "study.name"),
    column(name = "description", data_type = "TEXT", sql = "study.description"),
    column(
        name = "tags",
        data_type = "TEXT",
        sql = "osrd_prepare_for_search_tags(study.tags)"
    ),
    column(name = "project_id", data_type = "INTEGER", sql = "study.project_id")
)]
#[allow(unused)]
/// A search result item for a query with `object = "study"`
pub(super) struct SearchResultItemStudy {
    #[search(sql = "study.id")]
    id: u64,
    #[search(sql = "study.project_id")]
    project_id: u64,
    #[search(sql = "study.name")]
    name: String,
    #[search(
        sql = "(SELECT COUNT(scenario.id) FROM scenario WHERE search_study.id = scenario.study_id)"
    )]
    scenarios_count: u64,
    #[search(sql = "study.description")]
    #[schema(required)]
    description: Option<String>,
    #[search(sql = "study.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "study.tags")]
    tags: Vec<String>,
    #[search(sql = "study.budget")]
    #[schema(required)]
    budget: Option<u32>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    name = "scenario",
    table = "search_scenario",
    joins = "
        INNER JOIN scenario ON scenario.id = search_scenario.id
        INNER JOIN infra ON infra.id = scenario.infra_id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string"),
    column(name = "study_id", data_type = "integer")
)]
#[allow(unused)]
/// A search result item for a query with `object = "scenario"`
pub(super) struct SearchResultItemScenario {
    #[search(sql = "scenario.id")]
    id: u64,
    #[search(sql = "scenario.study_id")]
    study_id: u64,
    #[search(sql = "scenario.name")]
    name: String,
    #[search(sql = "scenario.electrical_profile_set_id")]
    #[schema(required)]
    electrical_profile_set_id: Option<u64>,
    #[search(sql = "scenario.infra_id")]
    infra_id: u64,
    #[search(sql = "infra.name")]
    infra_name: String,
    #[search(
        sql = "(SELECT COUNT(trains.id) FROM train_schedule AS trains WHERE scenario.timetable_id = trains.timetable_id)"
    )]
    trains_count: u64,
    #[search(sql = "scenario.description")]
    description: String,
    #[search(sql = "scenario.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "scenario.tags")]
    tags: Vec<String>,
}

/// See [crate::views::search::SearchConfigStore::find]
#[derive(SearchConfigStore)]
pub struct SearchConfigFinder;
