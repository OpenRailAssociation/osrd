use std::collections::BTreeMap;
use std::collections::VecDeque;

use actix_web::dev::HttpServiceFactory;
use tracing::warn;
use utoipa::openapi::path::PathItemBuilder;
use utoipa::openapi::schema::AnyOf;
use utoipa::openapi::AllOf;
use utoipa::openapi::Array;
use utoipa::openapi::Object;
use utoipa::openapi::OneOf;
use utoipa::openapi::PathItem;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;

pub struct Routes<F: HttpServiceFactory> {
    pub service: F,
    pub paths: OpenApiPathScope,
}

#[derive(Debug)]
pub struct OpenApiPathScope {
    pub prefix: Option<&'static str>,
    pub paths: VecDeque<Dispatch>,
}

#[allow(unused)]
pub enum Dispatch {
    Path(String, PathItem),
    Scope(Box<OpenApiPathScope>),
}

impl std::fmt::Debug for Dispatch {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Dispatch::Path(p, _) => write!(f, "Path({p:?})"),
            Dispatch::Scope(r) => write!(f, "Scope({:?})", *r),
        }
    }
}

impl<F: HttpServiceFactory> std::fmt::Debug for Routes<F> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Routes")
            .field("service", &"<unprintable>")
            .field("paths", &self.paths)
            .finish()
    }
}

#[allow(unused)]
impl OpenApiPathScope {
    pub fn new(prefix: Option<&'static str>) -> Self {
        Self {
            prefix,
            paths: VecDeque::new(),
        }
    }

    pub fn route<S: AsRef<str>>(mut self, openapi_path: S, openapi_pathitem: PathItem) -> Self {
        self.paths.push_back(Dispatch::Path(
            openapi_path.as_ref().to_owned(),
            openapi_pathitem,
        ));
        self
    }

    pub fn scope(mut self, scope: Self) -> Self {
        self.paths.push_back(Dispatch::Scope(Box::new(scope)));
        self
    }

    pub fn into_flat_path_list(self) -> Vec<(String, PathItem)> {
        let prefix = self.prefix.unwrap_or_default();
        let mut paths = Vec::new();

        fn concat_path<A: AsRef<str>, B: AsRef<str>>(a: A, b: B) -> String {
            let (a, b) = (a.as_ref(), b.as_ref());
            match (a.ends_with('/'), b.starts_with('/')) {
                (true, true) => format!("{}{}", a, &b[1..]),
                (false, false) => format!("{}/{}", a, b),
                _ => format!("{}{}", a, b),
            }
        }

        for item in self.paths {
            match item {
                Dispatch::Path(path, pathitem) => paths.push((concat_path(prefix, path), pathitem)),
                Dispatch::Scope(scope) => paths.append(
                    &mut scope
                        .into_flat_path_list()
                        .into_iter()
                        .map(|(path, pathitem)| (concat_path(prefix, path), pathitem))
                        .collect(),
                ),
            }
        }
        paths
    }
}

pub(super) fn merge_path_items(a: PathItem, b: PathItem) -> PathItem {
    let mut builder = PathItemBuilder::new()
        .summary(a.summary.or(b.summary))
        .description(a.description.or(b.description))
        .parameters(match (a.parameters, b.parameters) {
            (Some(a), Some(b)) => Some(a.into_iter().chain(b).collect()),
            (Some(p), None) | (None, Some(p)) => Some(p),
            (None, None) => None,
        })
        .servers(match (a.servers, b.servers) {
            (Some(a), Some(b)) => Some(a.into_iter().chain(b).collect()),
            (Some(s), None) | (None, Some(s)) => Some(s),
            (None, None) => None,
        });
    let mut operations: BTreeMap<_, _> = a.operations;
    for (method, operation) in b.operations {
        if operations.contains_key(&method) {
            warn!(
                "duplicate operation for method {}",
                serde_json::to_string(&method).unwrap() // PathItemType does not implement Display or Debug :(
            );
        }
        operations.insert(method, operation);
    }
    for (method, operation) in operations {
        builder = builder.operation(method, operation);
    }
    builder.build()
}

impl<F: HttpServiceFactory> HttpServiceFactory for Routes<F> {
    fn register(self, config: &mut actix_web::dev::AppService) {
        self.service.register(config);
    }
}

/// A macro that given a tree of routes, generates the corresponding [Routes]
/// object which also includes both the actix service and the routes' OpenAPI info
///
/// Note that you cannot have more than 12 services at the same scope level
/// because HttpServiceFactory is not implemented for tuples with more than 12
/// services (actix's fault, not mine, I swear 🥺). If you need more than 12
/// services just group them within parentheses. A scope counts as one service.
///
/// That macro will generate a funciton `fn routes() -> Routes` that you can use
/// inside another `routes!` invocation to include all the routes of another
/// module. This is useful to split the routes in multiple files.
///
/// Also note that the order of the services will be kept the same, so you might
/// encounter the classic actix issue that the first route that matches a request
/// will be used instead of the one you expect because of the order of the services.
///
/// Finally, all the endpoints used in this macro **MUST** be annotated using
/// `#[utoipa::path(...)]`, even if left empty.
///
/// # Example
/// ```
/// routes! {
///     "/infra" => {
///         cache_status,
///         "/{infra}" => {
///             load,
///             get,
///             (s1, s2, s3, s4, s5, s6, s7, s8, s9, "/s" => { s10 }, s11, s12),
///         },
///         sub_module::routes(),
///         other_endpoint
///     }
/// }
/// ```
#[macro_export]
macro_rules! routes {
    // TODO: apply the same pattern than schemas! with the three item types: ident, &path and expr

    // end of recursion, return the built expression
    (@routes [$($routes:expr)*]) => { ($($routes),*) };
    (@paths [$p:expr]) => { $p };

    // collect the endpoint and continue
    (@routes [$($acc:expr)*] $route:ident , $($rest:tt)*) => {
        $crate::routes!(@routes [$($acc)* $route] $($rest)*)
    };
    // retrieve the openapi data of the endpoint and continue
    (@paths [$p:expr] $route:ident , $($rest:tt)*) => {
        $crate::routes!(@paths
            [paste::paste! {
                $p.route(
                    <[<__path_ $route>] as utoipa::Path>::path(),
                    <[<__path_ $route>] as utoipa::Path>::path_item(None)
                )
            }]
            $($rest)*
        )
    };

    // create a scope, recurse within the scope, and continue collecting at the same level
    (@routes [$($acc:expr)*] $prefix:literal => {$($tt:tt)+} , $($rest:tt)*) => {
        $crate::routes!(@routes [$($acc)* actix_web::web::scope($prefix).service(
            $crate::routes!(@routes [] $($tt)+)
        )] $($rest)*)
    };
    // ditto
    (@paths [$p:expr] $prefix:literal => {$($tt:tt)+} , $($rest:tt)*) => {
        $crate::routes!(@paths [$p.scope(
            $crate::routes!(@paths [$crate::views::openapi::OpenApiPathScope::new(Some($prefix))] $($tt)+)
        )] $($rest)*)
    };

    // FIXME: add memoization to avoid calling routes() twice
    // call the routes() function for the submodule and collect just the service
    (@routes [$($acc:expr)*] $sub:ident ::routes() , $($rest:tt)*) => {
        $crate::routes!(@routes [$($acc)* $sub::routes().service] $($rest)*)
    };
    // call the routes() function for the submodule and collect just the openapi description
    (@paths [$p:expr] $sub:ident ::routes() , $($rest:tt)*) => {
        $crate::routes!(@paths [$p.scope($sub::routes().paths)] $($rest)*)
    };

    // tuple of services, just recurse within the tuple and continue parsing the same level
    (@routes [$($acc:expr)*] ($($tt:tt)*) , $($rest:tt)*) => {
        $crate::routes!(@routes [$($acc)*
            $crate::routes!(@routes [] $($tt)*)
        ] $($rest)*)
    };
    (@paths [$p:expr] ($($tt:tt)*) , $($rest:tt)*) => {
        $crate::routes!(@paths [$p.scope(
            $crate::routes!(@paths [$crate::views::openapi::OpenApiPathScope::new(None)] $($tt)*)
         )] $($rest)*)
    };

    // handles a terminating term without a trailing comma
    (@routes [$($acc:expr)*] $route:ident) => { $crate::routes!(@routes [$($acc)*] $route ,) };
    (@paths [$p:expr] $route:ident) => { $crate::routes!(@paths [$p] $route ,) };
    (@routes [$($acc:expr)*] $prefix:literal => {$($tt:tt)+}) => { $crate::routes!(@routes [$($acc)*] $prefix => {$($tt)+} ,) };
    (@paths [$p:expr] $prefix:literal => {$($tt:tt)+}) => { $crate::routes!(@paths [$p] $prefix => {$($tt)+} ,) };
    (@routes [$($acc:expr)*] $sub:ident ::routes()) => { $crate::routes!(@routes [$($acc)*] $sub ::routes() ,) };
    (@paths [$p:expr] $sub:ident ::routes()) => { $crate::routes!(@paths [$p] $sub ::routes() ,) };
    (@routes [$($acc:expr)*] ($($tt:tt)*)) => { $crate::routes!(@routes [$($acc)*] ($($tt)*) ,) };
    (@paths [$p:expr] ($($tt:tt)*)) => { $crate::routes!(@paths [$p] ($($tt)*) ,) };

    // error handling to avoid falling back to the macro entry point and get recursion errors
    (@routes $($tt:tt)*) => { compile_error!(stringify!("routes!: could not parse @routes: " $($tt)*)) };
    (@paths $($tt:tt)*) => { compile_error!(stringify!("routes!: could not parse @paths: " $($tt)*)) };

    // entry point
    ($($tt:tt)*) => {
        pub fn routes() -> $crate::views::openapi::Routes<impl actix_web::dev::HttpServiceFactory>  {
            $crate::views::openapi::Routes {
                service: $crate::routes!(@routes [] $($tt)*),
                paths: $crate::routes!(@paths [$crate::views::openapi::OpenApiPathScope::new(None)] $($tt)*)
            }
        }
    }
}

pub(super) fn remove_discriminator(schema: &mut RefOr<Schema>) {
    match schema {
        RefOr::T(Schema::AllOf(AllOf {
            items,
            discriminator,
            ..
        }))
        | RefOr::T(Schema::AnyOf(AnyOf {
            items,
            discriminator,
            ..
        }))
        | RefOr::T(Schema::OneOf(OneOf {
            items,
            discriminator,
            ..
        })) => {
            let _ = discriminator.take();
            for item in items.iter_mut() {
                remove_discriminator(item);
            }
        }
        RefOr::T(Schema::Object(Object { properties, .. })) => {
            for property in properties.values_mut() {
                remove_discriminator(property);
            }
        }
        RefOr::T(Schema::Array(Array { items, .. })) => {
            remove_discriminator(items);
        }
        _ => (),
    }
}
