table! {
    osrd_infra_infra {
        id -> Integer,
        name -> Text,
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
