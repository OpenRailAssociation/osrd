use chrono::NaiveDateTime;
use editoast_derive::{Search, SearchConfigStore};

use crate::schema::GeoJson;

// NOTE: every structure deriving `Search` here might have to `#[allow(unused)]`
// because while the name and type information of the fields are read by the macro,
// they might not be explicitly used in the code. (Their JSON representation extracted
// from the DB query is direcly forwarded into the endpoint response, so these
// structs are never deserialized, hence their "non-usage".)

#[derive(Search)]
#[search(
    table = "search_track",
    column(name = "infra_id", data_type = "INT"),
    column(name = "line_code", data_type = "INT"),
    column(name = "line_name", data_type = "TEXT")
)]
#[allow(unused)]
struct Track {
    #[search(sql = "search_track.infra_id")]
    infra_id: i64,
    #[search(sql = "search_track.unprocessed_line_name")]
    line_name: String,
    #[search(sql = "search_track.line_code")]
    line_code: i64,
}

#[derive(Search)]
#[search(
    table = "search_operational_point",
    joins = "
        INNER JOIN infra_object_operational_point AS OP ON OP.id = search_operational_point.id
        INNER JOIN infra_layer_operational_point AS lay ON OP.obj_id = lay.obj_id AND OP.infra_id = lay.infra_id",
    column(name = "obj_id", data_type = "string"),
    column(name = "infra_id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "uic", data_type = "integer"),
    column(name = "ch", data_type = "string"),
    column(name = "trigram", data_type = "string")
)]
#[allow(unused)]
struct OperationalPoint {
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
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: GeoJson,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.schematic, 4326))::json")]
    schematic: GeoJson,
    #[search(sql = "OP.data->'parts'")]
    track_sections: Vec<OperationalPointTrackSections>,
}
#[allow(unused)]
struct OperationalPointTrackSections {
    track: String,
    position: f64,
}

#[derive(Search)]
#[search(
    table = "search_signal",
    migration(
        src_table = "infra_object_signal",
        query_joins = "
            INNER JOIN infra_object_track_section AS track_section
            ON track_section.infra_id = infra_object_signal.infra_id 
                AND track_section.obj_id = infra_object_signal.data->>'track'"
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
struct Signal {
    #[search(sql = "sig.infra_id")]
    infra_id: String,
    #[search(sql = "sig.data->'extensions'->'sncf'->>'label'")]
    label: String,
    #[search(sql = "search_signal.signaling_systems")]
    signaling_systems: Vec<String>,
    #[search(sql = "search_signal.settings")]
    settings: Vec<String>,
    #[search(sql = "search_signal.line_code")]
    line_code: String,
    #[search(sql = "track_section.data->'extensions'->'sncf'->>'line_name'")]
    line_name: String,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: String,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.schematic, 4326))::json")]
    schematic: String,
}

#[derive(Search)]
#[search(
    table = "search_project",
    joins = "INNER JOIN project ON project.id = search_project.id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string")
)]
#[allow(unused)]
struct Project {
    #[search(sql = "project.id")]
    id: u64,
    #[search(sql = "project.image_id")]
    image: u64,
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

#[derive(Search)]
#[search(
    table = "search_study",
    joins = "INNER JOIN study ON study.id = search_study.id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string"),
    column(name = "project_id", data_type = "integer")
)]
#[allow(unused)]
struct Study {
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
    description: String,
    #[search(sql = "study.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "study.tags")]
    tags: Vec<String>,
}

#[derive(Search)]
#[search(
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
struct Scenario {
    #[search(sql = "scenario.id")]
    id: u64,
    #[search(sql = "scenario.study_id")]
    study_id: u64,
    #[search(sql = "scenario.name")]
    name: String,
    #[search(sql = "scenario.electrical_profile_set_id")]
    electrical_profile_set_id: u64,
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
