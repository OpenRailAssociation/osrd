//! Provides [OpenApiMerger] that can be used to merge our old manually written
//! OpenAPI with the new generated one incrementally in order to avoid protential
//! breaking changes.

use std::{
    collections::{BTreeMap, VecDeque},
    path::Path,
};

use actix_web::dev::HttpServiceFactory;
use serde_json::Value as Json;
use utoipa::{
    openapi::{
        path::PathItemBuilder, schema::AnyOf, AllOf, Array, Object, OneOf, PathItem, RefOr, Schema,
    },
    ToSchema,
};

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
    Path(&'static str, PathItem),
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

    pub fn route(mut self, openapi_path: &'static str, openapi_pathitem: PathItem) -> Self {
        self.paths
            .push_back(Dispatch::Path(openapi_path, openapi_pathitem));
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
            log::warn!(
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

#[derive(Default)]
pub struct LocalSchemas {
    pub schemas: BTreeMap<String, RefOr<Schema>>,
}

impl LocalSchemas {
    pub fn schema<'__s, S: ToSchema<'__s>>(mut self) -> Self {
        let (name, schema) = S::schema();
        self.schemas.insert(name.to_owned(), schema);
        self
    }

    pub fn include(mut self, other: Self) -> Self {
        self.schemas.extend(other.schemas);
        self
    }
}

impl IntoIterator for LocalSchemas {
    type Item = (String, RefOr<Schema>);
    type IntoIter = std::collections::btree_map::IntoIter<String, RefOr<Schema>>;

    fn into_iter(self) -> Self::IntoIter {
        self.schemas.into_iter()
    }
}

/// A macro that given a list of schemas, generates a function `fn schemas() -> LocalSchemas`
/// that returns the list of schemas
///
/// That way you don't have to import every schema in views/mod.rs to include them
/// in the top openapi annotation.
///
/// You can include schemas in another module my preceding them with `&`.
///
/// You can also use expressions that return a [LocalSchemas] object–such as
/// another `schema()` call, to forward it through the module hierarchy.
///
/// **YOU HAVE TO LEAVE A TRAILING COMMA AFTER THE LAST ITEM!!!**
///
/// # Example
///
/// ```
/// schemas! {
///     MySchema,
///     &nested::module::Schema,
///     &crate::Schema,
///     sub_module::schemas(),
///     AnotherScheman,
/// }
/// ```
#[macro_export]
macro_rules! schemas {
    (@build [$b:expr]) => { $b };

    (@build [$b:expr] $schema:ident , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.schema::<$schema>()] $($rest)*)
    };

    (@build [$b:expr] & $schema:path , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.schema::<$schema>()] $($rest)*)
    };

    (@build [$b:expr] $sub:expr , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.include($sub)] $($rest)*)
    };

    (@build [$b:expr] $($tt:tt)*) => { compile_error!(stringify!("schemas!: invalid specifier: " $($tt)*)) };

    ($($tt:tt)*) => {
        pub fn schemas() -> $crate::views::openapi::LocalSchemas {
            $crate::schemas!(@build [$crate::views::openapi::LocalSchemas::default()] $($tt)*)
        }
    };
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

pub(super) struct OpenApiMerger {
    old: Json,
    new: Json,
}

/// Returns the parent object of the JSON at path and the key to access the child, if they exist
fn find_parent_of<'a>(
    path: &'a Path,
    json: &'a mut Json,
) -> Option<(&'a mut Json, Option<String>)> {
    find_json_at(path.parent().expect("path should have a parent"), json).map(|(parent, _)| {
        let key =
            find_path_in_object(Path::new(path.file_name().unwrap()), parent).map(|(key, _)| key);
        (parent, key)
    })
}

/// Searches the json object for the given path, returning its original key and
/// the extra path components, if they exist
fn find_path_in_object<'a>(path: &'a Path, json: &Json) -> Option<(String, &'a Path)> {
    for key in json.as_object().unwrap().keys() {
        let mut key_path = Path::new(key);
        key_path = key_path.strip_prefix("/").unwrap_or(key_path);
        if path.starts_with(key_path) {
            let relative_path = path.strip_prefix(key_path).unwrap();
            return Some((key.clone(), relative_path));
        }
    }
    None
}

/// Returns the JSON value at path and its key in its parent, if they exist
fn find_json_at<'a>(mut path: &'a Path, json: &'a mut Json) -> Option<(&'a mut Json, String)> {
    path = path.strip_prefix("/").unwrap_or(path);
    if path == Path::new("") {
        return Some((json, String::new()));
    }
    let object = json.as_object_mut().expect("json in path is not an object");
    for (key, json) in object.iter_mut() {
        let mut key_path = Path::new(key);
        key_path = key_path.strip_prefix("/").unwrap_or(key_path);
        if path.starts_with(key_path) {
            let relative_path = path.strip_prefix(key_path).unwrap();
            match find_json_at(relative_path, json) {
                Some((json, last_key)) if last_key.is_empty() => return Some((json, key.clone())),
                None => continue,
                ret => return ret,
            }
        }
    }
    None
}

/// Tries to find the JSON value at path. If the full path doesn't exist in the document,
/// the function returns the deepest existing object alongwith the remaining non-existent path
fn try_find_json_at<'a>(mut path: &'a Path, json: &'a mut Json) -> (&'a mut Json, &'a Path) {
    path = path.strip_prefix("/").unwrap_or(path);
    if path == Path::new("") {
        return (json, path);
    }
    if !json.is_object() {
        return (json, path);
    };
    let ro_json = json.to_owned();
    if let Some((key, relative_path)) = find_path_in_object(path, &ro_json) {
        try_find_json_at(
            relative_path,
            json.as_object_mut().unwrap().get_mut(&key).unwrap(),
        )
    } else {
        (json, path)
    }
}

impl OpenApiMerger {
    pub fn new(old_content: String, new_content: String) -> Self {
        Self {
            old: serde_yaml::from_str(&old_content)
                .expect("the old OpenAPI should be a valid YAML or JSON doc"),
            new: serde_yaml::from_str(&new_content)
                .expect("the new OpenAPI should be a valid YAML or JSON doc"),
        }
    }

    /// Deletes a subtree from the old json openapi
    #[must_use]
    #[allow(unused)]
    pub fn reject_old(mut self, path: &str) -> Self {
        let path = Path::new(path);
        let key = path
            .file_name()
            .expect("the path to reject should exist in the old OpenApi")
            .to_str()
            .unwrap()
            .to_owned();
        if let (json, Some(key)) =
            find_parent_of(path, &mut self.old).expect("reject_old: could not find object at path")
        {
            json.as_object_mut().unwrap().remove(&key);
        }
        self
    }

    /// Smart replacement and insertion of the new openapi elements into the old one.
    /// This functions expect that the new openapi contains components at `components/schemas/` and paths at `paths/`.
    pub fn smart_merge(mut self) -> Self {
        // Merge components
        let components_path = Path::new("components/schemas/");
        let new_schemas = find_json_at(components_path, &mut self.new)
            .expect("No components found in the new OpenApi")
            .0
            .as_object_mut()
            .unwrap();
        let old_schemas = find_json_at(components_path, &mut self.old)
            .expect("No components found in the old OpenApi")
            .0
            .as_object_mut()
            .unwrap();
        for (key, schema) in new_schemas.iter_mut() {
            old_schemas.insert(key.clone(), schema.clone());
        }

        // Merge endpoint paths
        let paths_path = Path::new("paths/");
        let new_paths = find_json_at(paths_path, &mut self.new)
            .expect("No paths found in the new OpenApi")
            .0
            .as_object_mut()
            .unwrap();
        for (key, path) in new_paths.iter_mut() {
            let endpoint_path = Path::new("paths/").join(key.trim_matches('/'));
            match find_json_at(endpoint_path.as_path(), &mut self.old) {
                // The endpoint already exists, merge the operations
                Some((old_path, _)) => {
                    let old_path = old_path.as_object_mut().unwrap();
                    for (method, operation) in path.as_object_mut().unwrap().iter_mut() {
                        old_path.insert(method.clone(), operation.clone());
                    }
                }
                // The endpoint doesn't exist, insert all operations
                None => {
                    let old_paths = find_json_at(Path::new("paths/"), &mut self.old).unwrap().0;
                    let old_paths = old_paths.as_object_mut().unwrap();
                    old_paths.insert(key.clone(), path.clone());
                }
            }
        }
        self
    }

    /// Takes the subtree at `new_src_path` in the new openapi alongwith its
    /// key and inserts it into the object of the old openapi at `old_parent_path`
    ///
    /// ```
    /// let old = json!({"paths": {"/A": null, "/B": {"C/": null}}});
    /// let new = json!({"paths": {"/A": 12, "/B": null, "/B/C": null}});
    /// assert_eq!(
    ///     OpenApiMerger::new(old.to_string(), new.to_string())
    ///         .take_new("paths/A", "paths")
    ///         .take_new("paths/B/C", "paths")
    ///         .finish();
    ///     json!({"paths": {"/A": 12, "/B": {"C/": null}, "B/C/": null}})
    /// );
    /// ```
    #[must_use]
    #[allow(unused)]
    pub fn take_new(mut self, new_src_path: &str, old_parent_path: &str) -> Self {
        let src = Path::new(new_src_path);
        let (new_object, new_key) =
            find_json_at(src, &mut self.new).expect("take_new: src object must exist");
        let dst = Path::new(old_parent_path);
        let dst_object = find_json_at(dst, &mut self.old)
            .expect("take_new: old_parent_path must exist")
            .0;
        let dst_map = dst_object
            .as_object_mut()
            .expect("take_new: old_parent_path must be an object");
        if let Some((_, old_key)) =
            find_json_at(Path::new(&new_key), &mut Json::Object(dst_map.to_owned()))
        {
            dst_map.remove(&old_key);
        }
        dst_map.insert(new_key, new_object.clone());
        self
    }

    /// Takes the subtree at `new_src_path` in the new openapi and puts it at
    /// the key `old_parent_path` in the old openapi
    ///
    /// ```
    /// let old = json!({"paths": {"/A": null, "/B": {"C/": null}}});
    /// let new = json!({"paths": {"/A": 12, "/B": null, "/B/C": 42}});
    /// assert_eq!(
    ///     OpenApiMerger::new(old.to_string(), new.to_string())
    ///         .put_at("paths/A", "paths/A")
    ///         .put_at("paths/B/C", "paths/B/C")
    ///         .finish();
    ///     json!({"paths": {"/A": 12, "/B": {"C/": 42}}})
    /// );
    /// ```
    ///
    /// See [OpenApiMerger::replace]
    #[must_use]
    #[allow(unused)]
    pub fn put_at(mut self, new_src_path: &str, old_dst_path: &str) -> Self {
        let src = Path::new(new_src_path);
        let (new_object, _) =
            find_json_at(src, &mut self.new).expect("put_at: src object must exist");
        let dst = Path::new(old_dst_path);
        let (parent_object, old_key) =
            find_parent_of(dst, &mut self.old).expect("put_at: old_dst_path parent must exist");
        parent_object
            .as_object_mut()
            .expect("put_at: old_dst_path parent must be an object")
            .insert(
                old_key.unwrap_or_else(|| {
                    dst.file_name()
                        .expect("put_at: dst path should end with a key name")
                        .to_str()
                        .unwrap()
                        .to_owned()
                }),
                new_object.clone(),
            );
        self
    }

    /// Just like [Self::put_at] for when the src and the dst are identical
    #[must_use]
    #[allow(unused)]
    pub fn replace(self, path: &str) -> Self {
        self.put_at(path, path)
    }

    #[must_use]
    #[allow(unused)]
    /// Ensures that the full path exists by creating the hierarchy if not
    ///
    /// Does not overwrite existing values.
    pub fn create_path(mut self, path: &str) -> Self {
        let dst = Path::new(path);
        match try_find_json_at(dst, &mut self.old) {
            (_, path) if path == Path::new("") => {
                return self;
            }
            (json, path) => {
                let mut json = json;
                for key in path {
                    let key = key.to_str().unwrap();
                    let object = json.as_object_mut().unwrap();
                    object.insert(key.to_owned(), Json::Object(Default::default()));
                    json = object.get_mut(&key.to_owned()).unwrap();
                }
            }
        }
        self
    }

    /// Adds a trailing slash to all paths in the OpenAPI
    pub fn add_trailing_slash_to_paths(mut self) -> Self {
        let paths = self.old.as_object_mut().unwrap().get_mut("paths").unwrap();
        let paths = paths.as_object_mut().unwrap();
        for key in paths.keys().cloned().collect::<Vec<_>>() {
            if !key.ends_with('/') {
                let new_key = format!("{}/", key);
                let value = paths.remove(&key).unwrap().clone();
                paths.insert(new_key, value);
            }
        }
        self
    }

    /// Returns the merged OpenAPI
    pub fn finish(self) -> Json {
        self.old
    }
}

#[cfg(test)]
mod test {
    use pretty_assertions::assert_eq;
    use rstest::{fixture, rstest};
    use serde_json::{json, Value};

    use super::OpenApiMerger;

    #[fixture]
    fn old() -> Value {
        json!({
            "A": "old_A",
            "B": "old_B",
            "C": "old_C"
        })
    }

    #[fixture]
    fn new() -> Value {
        json!({
            "A": "new_A",
            "B": "new_B",
            "C": "new_C",
            "D": "new_D"
        })
    }

    #[rstest]
    fn test_simple_update(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("B")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "new_B",
                "C": "old_C"
            })
        )
    }

    #[rstest]
    fn test_simple_reject(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .reject_old("B")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "C": "old_C"
            })
        )
    }

    #[rstest]
    fn test_simple_new(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("D")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "old_B",
                "C": "old_C",
                "D": "new_D"
            })
        )
    }

    #[rstest]
    fn test_simple_take_new(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .take_new("B", "") // replacement
            .take_new("D", "") // insertion
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "new_B",
                "C": "old_C",
                "D": "new_D",
            })
        )
    }

    #[rstest]
    fn test_simple_put_at_existing_location(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .put_at("B", "A")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_B",
                "B": "old_B",
                "C": "old_C",
            })
        )
    }

    #[rstest]
    fn test_simple_put_at_new_location(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .put_at("D", "E")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "old_B",
                "C": "old_C",
                "E": "new_D"
            })
        )
    }

    #[rstest::rstest]
    async fn test_create_path() {
        assert_eq!(
            OpenApiMerger::new(
                json!({
                    "X": {
                        "Y": 42
                    }
                })
                .to_string(),
                "".to_owned()
            )
            .create_path("A")
            .create_path("nested/b/c/d")
            .create_path("X/Y") // no replacement
            .create_path("X/Z")
            .finish(),
            json!({
                "A": {},
                "nested": {
                    "b": {
                        "c": {
                            "d": {}
                        }
                    }
                },
                "X": {
                    "Y": 42,
                    "Z": {}
                }
            })
        );
    }

    #[rstest]
    fn test_simple_all(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("B")
            .reject_old("C")
            .put_at("D", "E")
            .put_at("A", "F")
            .take_new("A", "")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_A",
                "B": "new_B",
                "E": "new_D",
                "F": "new_A"
            })
        )
    }

    #[fixture]
    fn old_nested() -> Value {
        json!({
            "A": {
                "A1": "old_A1",
                "A2": "old_A2",
                "A3": "old_A3"
            },
            "B": {
                "B1": "old_B1",
                "B2": "old_B2",
                "B3": "old_B3"
            },
            "C": {
                "C1": "old_C1",
                "C2": "old_C2",
                "C3": "old_C3"
            }
        })
    }

    #[fixture]
    fn new_nested() -> Value {
        json!({
            "A": {
                "A1": "new_A1",
                "A2": "new_A2",
                "A3": "new_A3",
                "A4": "new_A4"
            },
            "B": {
                "B1": "new_B1",
                "B2": "new_B2",
                "B3": "new_B3",
                "B4": "new_B4"
            },
            "C": {
                "C1": "new_C1",
                "C2": "new_C2",
                "C3": "new_C3",
                "C4": "new_C4"
            },
            "D": {
                "D1": "new_D1",
                "D2": "new_D2",
                "D3": "new_D3"
            },
            "E": {
                "E1": "new_E1",
                "E2": "new_E2",
                "E3": "new_E3"
            }
        })
    }

    #[rstest]
    fn test_nested_reject(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .reject_old("B/B2")
            .reject_old("C")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3"
                },
                "B": {
                    "B1": "old_B1",
                    "B3": "old_B3"
                }
            })
        )
    }

    #[rstest]
    fn test_nested_new(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .replace("D") // existing dst
            .create_path("E")
            .replace("E/E1") // new dst
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3"
                },
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3"
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3"
                },
                "D": {
                    "D1": "new_D1",
                    "D2": "new_D2",
                    "D3": "new_D3"
                },
                "E": {
                    "E1": "new_E1"
                }
            })
        )
    }

    #[rstest]
    fn test_nested_put_at(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .put_at("B/B2", "A")
            .put_at("D", "C/C4")
            .create_path("C/C4/E1")
            .put_at("E/E1", "C/C4/E1/nested")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_B2",
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3"
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3",
                    "C4": {
                        "D1": "new_D1",
                        "D2": "new_D2",
                        "D3": "new_D3",
                        "E1": {
                            "nested": "new_E1"
                        }
                    }
                }
            })
        )
    }

    #[rstest]
    fn test_nested_take_new(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .take_new("B/B2", "A")
            .take_new("D", "C")
            .create_path("B/B4/nested")
            .take_new("E/E1", "B/B4/nested")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3",
                    "B2": "new_B2"
                },
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3",
                    "B4": {
                        "nested": {
                            "E1": "new_E1"
                        }
                    }
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3",
                    "D": {
                        "D1": "new_D1",
                        "D2": "new_D2",
                        "D3": "new_D3"
                    }
                }
            })
        )
    }

    #[rstest]
    async fn test_insaaaaane() {
        let hard_old = json!({
            "paths": {
                "/documents/": {
                    "post": "post"
                },
                "/documents/{key}/": {
                    "delete": "delete",
                    "get": "get"
                },
                "/electrical_profile_set/": {
                    "/": {
                        "get": "get",
                        "post": "post"
                    },
                    "/{id}/": {
                        "get": "get"
                    }
                }
            }
        });
        let hard_new = json!({
            "paths": {
                "/documents": {
                    "post": "post",
                    "patch": "patch"
                },
                "/documents/{key}/new": {
                    "get": "get",
                },
                "/documents/{key}/bye": {
                    "delete": "delete",
                },
                "/electrical_profile_set": {
                    "get": "get",
                    "post": "post",
                    "put": "put"
                },
                "/electrical_profile_set/{id}": {
                    "get": "get",
                    "delete": "delete",
                    "head": "head"
                }
            }
        });
        let merged = OpenApiMerger::new(hard_old.to_string(), hard_new.to_string())
            .replace("paths/documents/")
            .take_new("paths/documents/{key}/new", "paths")
            .take_new("paths/documents/{key}/bye", "paths")
            .take_new("paths/electrical_profile_set/", "paths") // takes the new one that replaces the old one with the trailing slash
            .finish();
        assert_eq!(
            merged,
            json!({
                "paths": {
                    "/documents/": {
                        "post": "post",
                        "patch": "patch"
                    },
                    "/documents/{key}/": {
                        "delete": "delete",
                        "get": "get"
                    },
                    "/electrical_profile_set": {
                        "get": "get",
                        "post": "post",
                        "put": "put"
                    },
                    "/documents/{key}/new": {
                        "get": "get",
                    },
                    "/documents/{key}/bye": {
                        "delete": "delete",
                    }
                }
            })
        );
    }

    #[rstest]
    async fn test_smart_merge() {
        let hard_old = json!({
            "paths": {
                "/documents/": {
                    "post": "old_post"
                },
                "/documents/{key}/": {
                    "delete": "delete",
                    "get": "get"
                },
                "/electrical_profile_set/": {
                    "get": "get",
                    "post": "post"
                }
            },
            "components": {
                "schemas": {
                    "A": "OLD_A",
                    "B": "B"
                }
            }
        });
        let hard_new = json!({
            "paths": {
                "/documents": {
                    "post": "post",
                    "patch": "patch"
                },
                "/documents/{key}/new": {
                    "get": "get",
                },
                "/documents/{key}/bye": {
                    "delete": "delete",
                },
                "/electrical_profile_set": {
                    "get": "get",
                    "post": "post",
                    "put": "put"
                },
                "/electrical_profile_set/{id}": {
                    "get": "get",
                    "delete": "delete",
                    "head": "head"
                }
            },
            "components": {
                "schemas": {
                    "A": "A",
                    "C": "C"
                }
            }
        });
        let merged = OpenApiMerger::new(hard_old.to_string(), hard_new.to_string())
            .smart_merge()
            .add_trailing_slash_to_paths()
            .finish();
        assert_eq!(
            merged,
            json!({
                "paths": {
                    "/documents/": {
                        "post": "post",
                        "patch": "patch"
                    },
                    "/documents/{key}/": {
                        "delete": "delete",
                        "get": "get"
                    },
                    "/electrical_profile_set/": {
                        "get": "get",
                        "post": "post",
                        "put": "put"
                    },
                    "/electrical_profile_set/{id}/": {
                        "get": "get",
                        "delete": "delete",
                        "head": "head"
                    },
                    "/documents/{key}/new/": {
                        "get": "get",
                    },
                    "/documents/{key}/bye/": {
                        "delete": "delete",
                    }
                },
                "components": {
                    "schemas": {
                        "A": "A",
                        "B": "B",
                        "C": "C"
                    }
                }
            })
        );
    }
}
