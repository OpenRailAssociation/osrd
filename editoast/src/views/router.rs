use std::collections::VecDeque;

// we cannot have a tuple (*const (), fn(...) -> ...) because raw pointers are not Send or Sync
pub(in crate::views) type OpenApiRouteSliceItem =
    fn(&str) -> Option<fn(Option<&str>) -> utoipa::openapi::path::PathItem>;

#[linkme::distributed_slice]
pub(in crate::views) static OPENAPI_ROUTES: [OpenApiRouteSliceItem];

#[derive(Debug, Default)]
pub(super) struct DocumentedRouter {
    pub(super) router: axum::Router<super::AppState>,
    pub(super) path_trees: Vec<PathTree>,
}

#[derive(Debug)]
pub(super) enum PathTree {
    Leaf {
        path_segment: &'static str,
        openapi: fn(Option<&str>) -> utoipa::openapi::path::PathItem,
    },
    Branch {
        path_segment: &'static str,
        sub_paths: Vec<PathTree>,
    },
}

impl PathTree {
    pub(super) fn flatten(self) -> Vec<(VecDeque<&'static str>, utoipa::openapi::path::PathItem)> {
        match self {
            PathTree::Leaf {
                path_segment,
                openapi,
            } => vec![(VecDeque::from([path_segment]), openapi(None))],
            PathTree::Branch {
                path_segment,
                sub_paths,
            } => {
                let mut paths = Vec::new();
                for sub_path in sub_paths {
                    for (mut path, item) in sub_path.flatten() {
                        path.push_front(path_segment);
                        paths.push((path, item));
                    }
                }
                paths
            }
        }
    }
}

impl DocumentedRouter {
    pub(super) fn root(f: impl FnOnce(Self) -> Self) -> Self {
        f(Self::default())
    }

    #[track_caller] // panic at the right line of the builder to find the faulty route easily
    pub(super) fn route(
        mut self,
        path: &'static str,
        (type_name, method_router, expected_method): (
            &str,
            axum::routing::MethodRouter<super::AppState>,
            utoipa::openapi::PathItemType,
        ),
    ) -> Self {
        let Some(openapi) = OPENAPI_ROUTES.iter().find_map(|matcher| matcher(type_name)) else {
            panic!("no openapi found for route {path} with type {type_name}!");
        };
        let operation_key = openapi(None)
            .operations
            .into_keys()
            .next()
            .expect("an utoipa path created using the path macro must have a method");
        if operation_key != expected_method {
            panic!(
                "expected method {} in the router at \"{path}\" but found {} in utoipa path",
                serde_json::to_string(&expected_method).unwrap(), // does not impl debug or display
                serde_json::to_string(&operation_key).unwrap()
            );
        }
        self.path_trees.push(PathTree::Leaf {
            path_segment: path,
            openapi,
        });
        Self {
            router: self.router.route(path, method_router),
            path_trees: self.path_trees,
        }
    }

    pub(super) fn nests(mut self, path: &'static str, f: impl FnOnce(Self) -> Self) -> Self {
        let Self { router, path_trees } = f(Self::default());
        self.path_trees.push(PathTree::Branch {
            path_segment: path,
            sub_paths: path_trees,
        });
        Self {
            router: self.router.nest(path, router),
            path_trees: self.path_trees,
        }
    }
}

macro_rules! get {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::get($f),
            utoipa::openapi::PathItemType::Get,
        )
    };
}

macro_rules! post {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::post($f),
            utoipa::openapi::PathItemType::Post,
        )
    };
}

macro_rules! delete {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::delete($f),
            utoipa::openapi::PathItemType::Delete,
        )
    };
}

macro_rules! put {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::put($f),
            utoipa::openapi::PathItemType::Put,
        )
    };
}

macro_rules! patch {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::patch($f),
            utoipa::openapi::PathItemType::Patch,
        )
    };
}

pub(super) use delete;
pub(super) use get;
pub(super) use patch;
pub(super) use post;
pub(super) use put;
