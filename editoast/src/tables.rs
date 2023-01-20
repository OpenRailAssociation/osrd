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
