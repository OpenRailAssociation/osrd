table! {
    osrd_infra_infra {
        id -> Integer,
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
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_signallayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_speedsectionlayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_tracksectionlinklayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_switchlayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_detectorlayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_bufferstoplayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_operationalpointlayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_catenarylayer {
        id -> Integer,
        obj_id -> Text,
        infra_id -> Integer,
    }
}

// Models

table! {
    osrd_infra_tracksectionmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_signalmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_speedsectionmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_tracksectionlinkmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_switchmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_switchtypemodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_detectormodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

diesel::table! {
    osrd_infra_bufferstopmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Jsonb,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_routemodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_operationalpointmodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}

table! {
    osrd_infra_catenarymodel(id) {
        id -> Integer,
        obj_id -> Text,
        data -> Json,
        infra_id -> Integer,
    }
}
