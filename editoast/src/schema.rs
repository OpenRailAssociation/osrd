table! {
    osrd_infra_infra {
        id -> Integer,
        name -> Text,
        version -> Text,
        generated_version -> Nullable<Text>,
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
    osrd_infra_routelayer {
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
