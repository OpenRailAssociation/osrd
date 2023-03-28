table! {
    osrd_infra_infra {
        id -> BigInt,
        name -> Text,
        railjson_version -> Text,
        version -> Text,
        generated_version -> Nullable<Text>,
        locked -> Bool,
        created -> Timestamp,
        modified -> Timestamp,
    }
}

table! {
    osrd_infra_tracksectionlayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_signallayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_speedsectionlayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_tracksectionlinklayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_switchlayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_detectorlayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_bufferstoplayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_operationalpointlayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_catenarylayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_lpvpanellayer {
        id -> BigInt,
        obj_id -> Text,
        infra_id -> BigInt,
        data -> Json,
    }
}

// Models

table! {
    osrd_infra_tracksectionmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_signalmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_speedsectionmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_tracksectionlinkmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_switchmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_switchtypemodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_detectormodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

diesel::table! {
    osrd_infra_bufferstopmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Jsonb,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_routemodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_operationalpointmodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_catenarymodel(id) {
        id -> BigInt,
        obj_id -> Text,
        data -> Json,
        infra_id -> BigInt,
    }
}

table! {
    osrd_infra_electricalprofileset(id) {
        id -> BigInt,
        name -> Text,
        data -> Jsonb,
    }
}

table! {
    osrd_infra_project {
        id -> BigInt,
        name -> Text,
        description -> Text,
        objectives -> Text,
        funders -> Text,
        budget -> Integer,
        image_id -> Nullable<BigInt>,
        creation_date -> Timestamp,
        last_modification -> Timestamp,
        tags -> Array<Text>,
    }
}

table! {
    osrd_infra_study {
        id -> BigInt,
        project_id -> BigInt,
        name -> Text,
        description -> Text,
        business_code -> Text,
        service_code -> Text,
        creation_date -> Timestamp,
        last_modification -> Timestamp,
        start_date -> Nullable<Date>,
        expected_end_date -> Nullable<Date>,
        actual_end_date -> Nullable<Date>,
        budget -> Integer,
        tags -> Array<Text>,
        state -> Text,
        study_type -> Text,
    }
}

joinable!(osrd_infra_study -> osrd_infra_project (project_id));

table! {
    osrd_infra_scenario {
        id -> BigInt,
        study_id -> BigInt,
        infra_id -> BigInt,
        electrical_profile_set_id -> Nullable<BigInt>,
        timetable_id -> BigInt,
        name -> Text,
        description -> Text,
        creation_date -> Timestamp,
        last_modification -> Timestamp,
        tags -> Array<Text>,
    }
}

table! {
    osrd_infra_document(id) {
        id -> BigInt,
        content_type -> Text,
        data -> Binary,
    }
}

table! {
    osrd_infra_rollingstock {
        id -> BigInt,
        name -> Text,
        version -> Text,
        effort_curves -> Jsonb,
        base_power_class -> Text,
        length -> Double,
        max_speed -> Double,
        startup_time -> Double,
        startup_acceleration -> Double,
        comfort_acceleration -> Double,
        gamma -> Jsonb,
        inertia_coefficient -> Double,
        features -> Array<Text>,
        mass -> Double,
        rolling_resistance -> Jsonb,
        loading_gauge -> Text,
        metadata -> Jsonb,
        power_restrictions -> Nullable<Jsonb>,
    }
}

table! {
    osrd_infra_rollingstocklivery(id) {
        id -> BigInt,
        name -> Text,
        rolling_stock_id -> BigInt,
        compound_image_id -> Nullable<BigInt>,
    }
}

table! {
    osrd_infra_rollingstockimage(id) {
        id -> BigInt,
        image -> Binary,
        livery_id -> Nullable<BigInt>,
        order -> Nullable<BigInt>,
    }
}

table! {
    osrd_infra_timetable(id) {
        id -> BigInt,
        name -> Text,
    }
}

table! {
    osrd_infra_trainschedule(id) {
        id -> BigInt,
        train_name -> Text,
        labels -> Jsonb,
        departure_time -> Double,
        initial_speed -> Double,
        allowances -> Jsonb,
        comfort -> Text,
        speed_limit_tags -> Nullable<Text>,
        power_restriction_ranges -> Nullable<Jsonb>,
        options -> Nullable<Jsonb>,
        path_id -> BigInt,
        rolling_stock_id -> BigInt,
        timetable_id -> BigInt,
    }
}

joinable!(  osrd_infra_trainschedule -> osrd_infra_timetable (timetable_id));

allow_tables_to_appear_in_same_query!(osrd_infra_trainschedule, osrd_infra_timetable);

table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    osrd_infra_pathmodel(id) {
        id -> BigInt,
        owner -> Uuid,
        created -> Timestamp,
        payload -> Jsonb,
        slopes -> Jsonb,
        curves -> Jsonb,
        geographic -> Geometry,
        schematic -> Geometry,
        infra_id -> BigInt,
    }
}

joinable!(osrd_infra_trainschedule -> osrd_infra_pathmodel (path_id));
