// select C.stuff from A inner join B C on C.id = C.id;
//                       \___________________________/
//                             a join expression
//                            C is an alias for B
type JoinExpr = &'static str;

/// Layer view description
#[derive(Debug)]
pub struct View {
    pub on_field: &'static str,
    pub data_expr: &'static str,
    pub exclude_fields: &'static [&'static str],
    pub joins: &'static [JoinExpr],
    pub where_expr: &'static [&'static str],
}

/// Layer description
#[derive(Debug)]
pub struct Layer {
    pub table_name: &'static str,
    pub geo: View,
    pub id_field: Option<&'static str>,
    pub attribution: Option<&'static str>,
}

pub const ALLOWED_VIEWS: &[&str] = &["geo"];
impl Layer {
    pub fn get_view(&self, view_slug: &str) -> Option<&View> {
        match view_slug {
            "geo" => Some(&self.geo),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct MapLayers {
    pub layers: phf::Map<&'static str, Layer>,
}

pub static MAP_LAYER_NAMES: std::sync::LazyLock<Vec<&'static str>> =
    std::sync::LazyLock::new(|| {
        let mut names: Vec<_> = MAP_LAYERS.layers.keys().copied().collect();
        names.sort();
        names
    });

pub const MAP_LAYERS: &MapLayers = &MapLayers {
    layers: phf::phf_map! {
        "track_sections" => TRACK_SECTIONS_LAYER,
        "signals" => SIGNALS_LAYER,
        "speed_sections" => SPEED_SECTIONS_LAYER,
        "psl" => PSL_LAYER,
        "switches" => SWITCHES_LAYER,
        "detectors" => DETECTORS_LAYER,
        "buffer_stops" => BUFFER_STOPS_LAYER,
        "operational_points" => OPERATIONAL_POINTS_LAYER,
        "electrifications" => ELECTRIFICATIONS_LAYER,
        "psl_signs" => PSL_SIGNS_LAYER,
        "neutral_signs" => NEUTRAL_SIGNS_LAYER,
        "neutral_sections" => NEUTRAL_SECTIONS_LAYER,
        "level_crossings" => LEVEL_CROSSING_LAYER,
        "errors" => ERRORS_LAYER,
    },
};

const TRACK_SECTIONS_LAYER: Layer = Layer {
    table_name: "infra_layer_track_section",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        // The `db` extension is free-form operator data that no map style reads, and it can be
        // large (alignment geometry). Strip it so it does not bloat every vector tile.
        data_expr: "(track_section.data #- '{extensions,db}')",
        exclude_fields: &["curves", "loading_gauge_limits", "slopes", "geo"],
        joins: &[
            "inner join infra_object_track_section track_section on track_section.obj_id = layer.obj_id and track_section.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const SIGNALS_LAYER: Layer = Layer {
    table_name: "infra_layer_signal",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "signal.data || jsonb_build_object('angle', layer.angle_geo, 'signaling_system', layer.signaling_system, 'sprite', layer.sprite)",
        exclude_fields: &[
            "logical_signals",
            "direction",
            "track",
            "position",
            "sight_distance",
        ],
        joins: &[
            "inner join infra_object_signal signal on signal.obj_id = layer.obj_id and signal.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const SPEED_SECTIONS_LAYER: Layer = Layer {
    table_name: "infra_layer_speed_section",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "speed_section.data",
        exclude_fields: &["track_ranges"],
        joins: &[
            "inner join infra_object_speed_section speed_section on speed_section.obj_id = layer.obj_id and speed_section.infra_id = layer.infra_id",
        ],
        where_expr: &["not (speed_section.data @? '$.extensions.psl_sncf.z')"],
    },
};

const PSL_LAYER: Layer = Layer {
    table_name: "infra_layer_speed_section",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "speed_section.data",
        exclude_fields: &["track_ranges", "extensions"],
        joins: &[
            "inner join infra_object_speed_section speed_section on speed_section.obj_id = layer.obj_id and speed_section.infra_id = layer.infra_id",
        ],
        where_expr: &["speed_section.data @? '$.extensions.psl_sncf.z'"],
    },
};

const SWITCHES_LAYER: Layer = Layer {
    table_name: "infra_layer_switch",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "switch.data",
        exclude_fields: &["ports", "switch_type", "group_change_delay"],
        joins: &[
            "inner join infra_object_switch switch on switch.obj_id = layer.obj_id and switch.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const DETECTORS_LAYER: Layer = Layer {
    table_name: "infra_layer_detector",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "detector.data",
        exclude_fields: &["track", "position"],
        joins: &[
            "inner join infra_object_detector detector on detector.obj_id = layer.obj_id and detector.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const BUFFER_STOPS_LAYER: Layer = Layer {
    table_name: "infra_layer_buffer_stop",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "buffer_stop.data",
        exclude_fields: &["track", "position"],
        joins: &[
            "inner join infra_object_buffer_stop buffer_stop on buffer_stop.obj_id = layer.obj_id and buffer_stop.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const OPERATIONAL_POINTS_LAYER: Layer = Layer {
    table_name: "infra_layer_operational_point",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "operational_point.data || jsonb_build_object('kp', layer.kp, 'track_name', track_section.data->'extensions'->'sncf'->'track_name', 'local_track_name', (SELECT elem->>'local_track_name' FROM jsonb_array_elements(operational_point.data->'parts') elem WHERE elem->>'track' = layer.track_section::text limit 1))",
        exclude_fields: &["parts", "plc"],
        joins: &[
            "inner join infra_object_operational_point operational_point on operational_point.obj_id = layer.obj_id and operational_point.infra_id = layer.infra_id",
            "inner join infra_object_track_section track_section on track_section.obj_id = layer.track_section and track_section.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const ELECTRIFICATIONS_LAYER: Layer = Layer {
    table_name: "infra_layer_electrification",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "electrification.data",
        exclude_fields: &["track_ranges"],
        joins: &[
            "inner join infra_object_electrification electrification on electrification.obj_id = layer.obj_id and electrification.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const PSL_SIGNS_LAYER: Layer = Layer {
    table_name: "infra_layer_psl_sign",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: r#"layer.data || jsonb_build_object(
  'angle', layer.angle_geo,
  'speed_limit_by_tag', speed_section.data->'speed_limit_by_tag',
  'speed_limit', speed_section.data->'speed_limit'
)
"#,
        exclude_fields: &[],
        joins: &[
            "inner join infra_object_speed_section speed_section on speed_section.obj_id = layer.obj_id and speed_section.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const NEUTRAL_SIGNS_LAYER: Layer = Layer {
    table_name: "infra_layer_neutral_sign",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "layer.data || jsonb_build_object('angle', layer.angle_geo)",
        exclude_fields: &["value"],
        joins: &[],
        where_expr: &[],
    },
};

const NEUTRAL_SECTIONS_LAYER: Layer = Layer {
    table_name: "infra_layer_neutral_section",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "neutral_section.data",
        exclude_fields: &["extensions", "track_ranges", "announcement_track_ranges"],
        joins: &[
            "inner join infra_object_neutral_section neutral_section on neutral_section.obj_id = layer.obj_id and neutral_section.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const LEVEL_CROSSING_LAYER: Layer = Layer {
    table_name: "infra_layer_level_crossing",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "level_crossing.data",
        exclude_fields: &["parts"],
        joins: &[
            "inner join infra_object_level_crossing level_crossing on level_crossing.obj_id = layer.obj_id and level_crossing.infra_id = layer.infra_id",
        ],
        where_expr: &[],
    },
};

const ERRORS_LAYER: Layer = Layer {
    table_name: "infra_layer_error",
    id_field: Some("id"),
    attribution: None,
    geo: View {
        on_field: "geographic",
        data_expr: "layer.information",
        exclude_fields: &["short_zone_length"],
        joins: &[],
        where_expr: &[],
    },
};
