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
        // TODO: add other fields fields
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
    osrd_infra_rollingstock(id) {
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
