use std::collections::VecDeque;

pub(super) struct RouteDocumentation {
    pub(super) http_methods: Vec<utoipa::openapi::path::HttpMethod>,
    pub(super) operation: utoipa::openapi::path::Operation,
    pub(super) tags: Vec<&'static str>,
    pub(super) schemas: Vec<(
        String,
        utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>,
    )>,
}

// fn(function_type_name) -> utoipa::Path::path_item
//
// We can't just build a slice of tuples (&'static str, fn) because std::any::type_name_of_val
// constness is unstable. So O(n^2) here we go...
//
// If this takes too long, we can always optimize it later (structure, search algorithm, featuring utoipa).
pub(in crate::views) type OpenApiRouteSliceItem = fn(&str) -> Option<fn() -> RouteDocumentation>;

#[linkme::distributed_slice]
pub(in crate::views) static OPENAPI_ROUTES: [OpenApiRouteSliceItem];

#[derive(Default)]
pub(super) struct DocumentedRouter {
    pub(super) router: axum::Router<super::AppState>,
    pub(super) path_trees: Vec<PathTree>,
}

pub(super) enum PathTree {
    Leaf {
        path_segment: &'static str,
        path_item: fn() -> RouteDocumentation,
    },
    Branch {
        path_segment: &'static str,
        sub_paths: Vec<PathTree>,
    },
}

pub(super) struct FlattenedPath {
    pub(super) path_segments: VecDeque<&'static str>,
    pub(super) path_item: utoipa::openapi::path::PathItem,
    pub(super) schemas: Vec<(
        String,
        utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>,
    )>,
}

impl PathTree {
    pub(super) fn flatten(self) -> Vec<FlattenedPath> {
        match self {
            PathTree::Leaf {
                path_segment,
                path_item,
            } => {
                let RouteDocumentation {
                    http_methods,
                    mut operation,
                    tags,
                    schemas,
                } = path_item();
                // Since utoipa 5.x, tags are provided separately and need to be added to the operation manually
                // as we're not collecting using the standard OpenApi macro.
                if !tags.is_empty() {
                    operation.tags = Some(tags.iter().map(|s| s.to_string()).collect());
                }
                let path_item =
                    utoipa::openapi::path::PathItem::from_http_methods(http_methods, operation);
                vec![FlattenedPath {
                    path_segments: VecDeque::from([path_segment]),
                    path_item,
                    schemas,
                }]
            }
            PathTree::Branch {
                path_segment,
                sub_paths,
            } => {
                let mut paths = Vec::new();
                for sub_path in sub_paths {
                    for mut flattened in sub_path.flatten() {
                        flattened.path_segments.push_front(path_segment);
                        paths.push(flattened);
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
            utoipa::openapi::HttpMethod,
        ),
    ) -> Self {
        let Some(path_item) = OPENAPI_ROUTES.iter().find_map(|matcher| matcher(type_name)) else {
            panic!("no openapi found for route {path} with type {type_name}!");
        };
        let RouteDocumentation { http_methods, .. } = path_item();
        if !http_methods.contains(&expected_method) {
            panic!(
                "expected method {} in the router at \"{path}\" but found {} in utoipa path",
                serde_json::to_string(&expected_method).unwrap(), // does not impl debug or display
                serde_json::to_string(&http_methods).unwrap()
            );
        }
        self.path_trees.push(PathTree::Leaf {
            path_segment: path,
            path_item,
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
            utoipa::openapi::HttpMethod::Get,
        )
    };
}

macro_rules! post {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::post($f),
            utoipa::openapi::HttpMethod::Post,
        )
    };
}

macro_rules! delete {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::delete($f),
            utoipa::openapi::HttpMethod::Delete,
        )
    };
}

macro_rules! put {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::put($f),
            utoipa::openapi::HttpMethod::Put,
        )
    };
}

macro_rules! patch {
    ($f:path) => {
        (
            std::any::type_name_of_val(&$f),
            axum::routing::patch($f),
            utoipa::openapi::HttpMethod::Patch,
        )
    };
}

pub(super) use delete;
pub(super) use get;
pub(super) use patch;
pub(super) use post;
pub(super) use put;
