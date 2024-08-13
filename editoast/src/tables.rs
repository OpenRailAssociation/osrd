// @generated automatically by Diesel CLI.

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    authn_group (id) {
        id -> Int8,
        name -> Text,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    authn_group_membership (id) {
        id -> Int8,
        user -> Int8,
        group -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    authn_subject (id) {
        id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    authn_user (id) {
        id -> Int8,
        #[max_length = 255]
        identity_id -> Varchar,
        name -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    authz_role (id) {
        id -> Int8,
        subject -> Int8,
        #[max_length = 255]
        role -> Varchar,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    document (id) {
        id -> Int8,
        #[max_length = 255]
        content_type -> Varchar,
        data -> Bytea,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    electrical_profile_set (id) {
        id -> Int8,
        #[max_length = 128]
        name -> Varchar,
        data -> Jsonb,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra (id) {
        id -> Int8,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 16]
        railjson_version -> Varchar,
        owner -> Uuid,
        #[max_length = 40]
        version -> Varchar,
        #[max_length = 40]
        generated_version -> Nullable<Varchar>,
        locked -> Bool,
        created -> Timestamptz,
        modified -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_buffer_stop (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_detector (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_electrification (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_error (id) {
        id -> Int8,
        geographic -> Nullable<Geometry>,
        information -> Jsonb,
        infra_id -> Int8,
        #[max_length = 40]
        info_hash -> Varchar,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_neutral_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_neutral_sign (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        angle_geo -> Float8,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_operational_point (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
        kp -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_psl_sign (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        data -> Jsonb,
        infra_id -> Int8,
        angle_geo -> Nullable<Float8>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_signal (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
        angle_geo -> Float8,
        #[max_length = 255]
        signaling_system -> Nullable<Varchar>,
        #[max_length = 255]
        sprite -> Nullable<Varchar>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_speed_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_switch (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_layer_track_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        geographic -> Geometry,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_buffer_stop (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_detector (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_electrification (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_extended_switch_type (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_neutral_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_operational_point (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_route (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_signal (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_speed_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_switch (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    infra_object_track_section (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Varchar,
        data -> Jsonb,
        infra_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    project (id) {
        id -> Int8,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 4096]
        objectives -> Nullable<Varchar>,
        #[max_length = 1024]
        description -> Nullable<Varchar>,
        #[max_length = 255]
        funders -> Nullable<Varchar>,
        budget -> Nullable<Int4>,
        creation_date -> Timestamptz,
        last_modification -> Timestamptz,
        tags -> Array<Nullable<Text>>,
        image_id -> Nullable<Int8>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    rolling_stock (id) {
        id -> Int8,
        #[max_length = 16]
        railjson_version -> Varchar,
        #[max_length = 255]
        name -> Varchar,
        effort_curves -> Jsonb,
        metadata -> Jsonb,
        length -> Float8,
        max_speed -> Float8,
        startup_time -> Float8,
        startup_acceleration -> Float8,
        comfort_acceleration -> Float8,
        gamma -> Jsonb,
        inertia_coefficient -> Float8,
        #[max_length = 255]
        base_power_class -> Nullable<Varchar>,
        mass -> Float8,
        rolling_resistance -> Jsonb,
        loading_gauge -> Int2,
        power_restrictions -> Jsonb,
        energy_sources -> Jsonb,
        locked -> Bool,
        electrical_power_startup_time -> Nullable<Float8>,
        raise_pantograph_time -> Nullable<Float8>,
        version -> Int8,
        supported_signaling_systems -> Array<Nullable<Text>>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    rolling_stock_livery (id) {
        id -> Int8,
        #[max_length = 255]
        name -> Varchar,
        rolling_stock_id -> Int8,
        compound_image_id -> Nullable<Int8>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    rolling_stock_separate_image (id) {
        id -> Int8,
        order -> Int4,
        livery_id -> Int8,
        image_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    scenario_v2 (id) {
        id -> Int8,
        infra_id -> Int8,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 1024]
        description -> Varchar,
        creation_date -> Timestamptz,
        last_modification -> Timestamptz,
        tags -> Array<Nullable<Text>>,
        timetable_id -> Int8,
        study_id -> Int8,
        electrical_profile_set_id -> Nullable<Int8>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_operational_point (id) {
        id -> Int8,
        #[max_length = 255]
        obj_id -> Nullable<Varchar>,
        infra_id -> Nullable<Int4>,
        uic -> Nullable<Int4>,
        #[max_length = 3]
        trigram -> Nullable<Varchar>,
        ci -> Nullable<Int4>,
        ch -> Nullable<Text>,
        name -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_project (id) {
        id -> Int8,
        name -> Nullable<Text>,
        description -> Nullable<Text>,
        tags -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_scenario (id) {
        id -> Int8,
        name -> Nullable<Text>,
        description -> Nullable<Text>,
        study_id -> Nullable<Int4>,
        tags -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_signal (id) {
        id -> Int8,
        label -> Nullable<Text>,
        line_name -> Nullable<Text>,
        infra_id -> Nullable<Int4>,
        #[max_length = 255]
        obj_id -> Nullable<Varchar>,
        signaling_systems -> Nullable<Array<Nullable<Text>>>,
        settings -> Nullable<Array<Nullable<Text>>>,
        line_code -> Nullable<Int4>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_study (id) {
        id -> Int8,
        name -> Nullable<Text>,
        description -> Nullable<Text>,
        project_id -> Nullable<Int4>,
        tags -> Nullable<Text>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    search_track (id) {
        infra_id -> Int4,
        line_code -> Int4,
        line_name -> Text,
        unprocessed_line_name -> Text,
        id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    stdcm_search_environment (id) {
        id -> Int8,
        infra_id -> Int8,
        electrical_profile_set_id -> Nullable<Int8>,
        work_schedule_group_id -> Nullable<Int8>,
        timetable_id -> Int8,
        search_window_begin -> Timestamptz,
        search_window_end -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    study (id) {
        id -> Int8,
        #[max_length = 128]
        name -> Varchar,
        #[max_length = 1024]
        description -> Nullable<Varchar>,
        #[max_length = 128]
        business_code -> Nullable<Varchar>,
        #[max_length = 128]
        service_code -> Nullable<Varchar>,
        creation_date -> Timestamptz,
        last_modification -> Timestamptz,
        start_date -> Nullable<Date>,
        expected_end_date -> Nullable<Date>,
        actual_end_date -> Nullable<Date>,
        budget -> Nullable<Int4>,
        tags -> Array<Nullable<Text>>,
        #[max_length = 16]
        state -> Varchar,
        #[max_length = 100]
        study_type -> Nullable<Varchar>,
        project_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    timetable_v2 (id) {
        id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    train_schedule (id) {
        id -> Int8,
        #[max_length = 128]
        train_name -> Varchar,
        labels -> Jsonb,
        departure_time -> Float8,
        initial_speed -> Float8,
        allowances -> Jsonb,
        #[max_length = 8]
        comfort -> Varchar,
        #[max_length = 128]
        speed_limit_tags -> Nullable<Varchar>,
        power_restriction_ranges -> Nullable<Jsonb>,
        options -> Nullable<Jsonb>,
        path_id -> Int8,
        rolling_stock_id -> Int8,
        timetable_id -> Int8,
        scheduled_points -> Jsonb,
        #[max_length = 40]
        infra_version -> Varchar,
        rollingstock_version -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    train_schedule_v2 (id) {
        id -> Int8,
        #[max_length = 128]
        train_name -> Varchar,
        labels -> Array<Nullable<Text>>,
        #[max_length = 128]
        rolling_stock_name -> Varchar,
        timetable_id -> Int8,
        start_time -> Timestamptz,
        schedule -> Jsonb,
        margins -> Jsonb,
        initial_speed -> Float8,
        comfort -> Int2,
        path -> Jsonb,
        constraint_distribution -> Int2,
        #[max_length = 128]
        speed_limit_tag -> Nullable<Varchar>,
        power_restrictions -> Jsonb,
        options -> Jsonb,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    work_schedule (id) {
        id -> Int8,
        start_date_time -> Timestamptz,
        end_date_time -> Timestamptz,
        track_ranges -> Jsonb,
        #[max_length = 255]
        obj_id -> Varchar,
        work_schedule_type -> Int2,
        work_schedule_group_id -> Int8,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use postgis_diesel::sql_types::*;

    work_schedule_group (id) {
        id -> Int8,
        creation_date -> Timestamptz,
        #[max_length = 255]
        name -> Varchar,
    }
}

diesel::joinable!(authn_group -> authn_subject (id));
diesel::joinable!(authn_group_membership -> authn_group (group));
diesel::joinable!(authn_group_membership -> authn_user (user));
diesel::joinable!(authn_user -> authn_subject (id));
diesel::joinable!(authz_role -> authn_subject (subject));
diesel::joinable!(infra_layer_buffer_stop -> infra (infra_id));
diesel::joinable!(infra_layer_detector -> infra (infra_id));
diesel::joinable!(infra_layer_electrification -> infra (infra_id));
diesel::joinable!(infra_layer_error -> infra (infra_id));
diesel::joinable!(infra_layer_neutral_section -> infra (infra_id));
diesel::joinable!(infra_layer_neutral_sign -> infra (infra_id));
diesel::joinable!(infra_layer_operational_point -> infra (infra_id));
diesel::joinable!(infra_layer_psl_sign -> infra (infra_id));
diesel::joinable!(infra_layer_signal -> infra (infra_id));
diesel::joinable!(infra_layer_speed_section -> infra (infra_id));
diesel::joinable!(infra_layer_switch -> infra (infra_id));
diesel::joinable!(infra_layer_track_section -> infra (infra_id));
diesel::joinable!(infra_object_buffer_stop -> infra (infra_id));
diesel::joinable!(infra_object_detector -> infra (infra_id));
diesel::joinable!(infra_object_electrification -> infra (infra_id));
diesel::joinable!(infra_object_extended_switch_type -> infra (infra_id));
diesel::joinable!(infra_object_neutral_section -> infra (infra_id));
diesel::joinable!(infra_object_operational_point -> infra (infra_id));
diesel::joinable!(infra_object_route -> infra (infra_id));
diesel::joinable!(infra_object_signal -> infra (infra_id));
diesel::joinable!(infra_object_speed_section -> infra (infra_id));
diesel::joinable!(infra_object_switch -> infra (infra_id));
diesel::joinable!(infra_object_track_section -> infra (infra_id));
diesel::joinable!(project -> document (image_id));
diesel::joinable!(rolling_stock_livery -> document (compound_image_id));
diesel::joinable!(rolling_stock_livery -> rolling_stock (rolling_stock_id));
diesel::joinable!(rolling_stock_separate_image -> document (image_id));
diesel::joinable!(rolling_stock_separate_image -> rolling_stock_livery (livery_id));
diesel::joinable!(scenario_v2 -> electrical_profile_set (electrical_profile_set_id));
diesel::joinable!(scenario_v2 -> infra (infra_id));
diesel::joinable!(scenario_v2 -> study (study_id));
diesel::joinable!(scenario_v2 -> timetable_v2 (timetable_id));
diesel::joinable!(search_operational_point -> infra_object_operational_point (id));
diesel::joinable!(search_project -> project (id));
diesel::joinable!(search_signal -> infra_object_signal (id));
diesel::joinable!(search_study -> study (id));
diesel::joinable!(stdcm_search_environment -> electrical_profile_set (electrical_profile_set_id));
diesel::joinable!(stdcm_search_environment -> infra (infra_id));
diesel::joinable!(stdcm_search_environment -> timetable_v2 (timetable_id));
diesel::joinable!(stdcm_search_environment -> work_schedule_group (work_schedule_group_id));
diesel::joinable!(study -> project (project_id));
diesel::joinable!(train_schedule -> rolling_stock (rolling_stock_id));
diesel::joinable!(train_schedule_v2 -> timetable_v2 (timetable_id));
diesel::joinable!(work_schedule -> work_schedule_group (work_schedule_group_id));

diesel::allow_tables_to_appear_in_same_query!(
    authn_group,
    authn_group_membership,
    authn_subject,
    authn_user,
    authz_role,
    document,
    electrical_profile_set,
    infra,
    infra_layer_buffer_stop,
    infra_layer_detector,
    infra_layer_electrification,
    infra_layer_error,
    infra_layer_neutral_section,
    infra_layer_neutral_sign,
    infra_layer_operational_point,
    infra_layer_psl_sign,
    infra_layer_signal,
    infra_layer_speed_section,
    infra_layer_switch,
    infra_layer_track_section,
    infra_object_buffer_stop,
    infra_object_detector,
    infra_object_electrification,
    infra_object_extended_switch_type,
    infra_object_neutral_section,
    infra_object_operational_point,
    infra_object_route,
    infra_object_signal,
    infra_object_speed_section,
    infra_object_switch,
    infra_object_track_section,
    project,
    rolling_stock,
    rolling_stock_livery,
    rolling_stock_separate_image,
    scenario_v2,
    search_operational_point,
    search_project,
    search_scenario,
    search_signal,
    search_study,
    search_track,
    stdcm_search_environment,
    study,
    timetable_v2,
    train_schedule,
    train_schedule_v2,
    work_schedule,
    work_schedule_group,
);
