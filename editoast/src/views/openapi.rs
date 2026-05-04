use std::collections::BTreeMap;

use itertools::Either;
use itertools::Itertools as _;
use tracing::debug;
use utoipa::OpenApi;
use utoipa::openapi::HttpMethod;
use utoipa::openapi::PathItem;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;
use utoipa::openapi::path::Operation;
use utoipa::openapi::path::PathItemBuilder;
use utoipa::openapi::schema::AdditionalProperties;
use utoipa::openapi::schema::AllOf;
use utoipa::openapi::schema::ArrayItems;
use utoipa::openapi::schema::OneOf;
use utoipa::openapi::schema::SchemaType;
use utoipa::openapi::schema::Type;

use crate::error::ErrorDefinition;
use crate::views::router::FlattenedPath;
use crate::views::service_router;

fn concat_path<A: AsRef<str>, B: AsRef<str>>(a: A, b: B) -> String {
    let (a, b) = (a.as_ref(), b.as_ref());
    match (a.ends_with('/'), b.starts_with('/')) {
        (true, true) => format!("{}{}", a, &b[1..]),
        _ => format!("{a}{b}"),
    }
}

fn path_item_operations(path_item: PathItem) -> BTreeMap<HttpMethod, Operation> {
    let mut operations = BTreeMap::new();
    operations.extend(path_item.get.map(|op| (HttpMethod::Get, op)));
    operations.extend(path_item.put.map(|op| (HttpMethod::Put, op)));
    operations.extend(path_item.post.map(|op| (HttpMethod::Post, op)));
    operations.extend(path_item.delete.map(|op| (HttpMethod::Delete, op)));
    operations.extend(path_item.options.map(|op| (HttpMethod::Options, op)));
    operations.extend(path_item.head.map(|op| (HttpMethod::Head, op)));
    operations.extend(path_item.patch.map(|op| (HttpMethod::Patch, op)));
    operations.extend(path_item.trace.map(|op| (HttpMethod::Trace, op)));
    operations
}

fn path_item_operations_mut(path_item: &mut PathItem) -> Vec<&mut Operation> {
    let mut operations = Vec::new();
    operations.extend(path_item.get.as_mut());
    operations.extend(path_item.put.as_mut());
    operations.extend(path_item.post.as_mut());
    operations.extend(path_item.delete.as_mut());
    operations.extend(path_item.options.as_mut());
    operations.extend(path_item.head.as_mut());
    operations.extend(path_item.patch.as_mut());
    operations.extend(path_item.trace.as_mut());
    operations
}

fn merge_path_items(mut a: PathItem, b: PathItem) -> PathItem {
    a.merge_operations(b.clone());
    let operations = path_item_operations(a.clone());
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
    for (method, operation) in operations {
        builder = builder.operation(method, operation);
    }
    builder.build()
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "OSRD Editoast",
        description = "All HTTP endpoints of Editoast",
        license(name = "LGPL", url = "https://www.gnu.org/licenses/lgpl-3.0.html"),
    ),
    components(schemas(
        json_patch::AddOperation,
        json_patch::CopyOperation,
        json_patch::MoveOperation,
        json_patch::Patch,
        json_patch::PatchOperation,
        json_patch::RemoveOperation,
        json_patch::ReplaceOperation,
        json_patch::TestOperation,
    ))
)]
pub struct OpenApiRoot;

impl OpenApiRoot {
    fn error_context_to_openapi_object(error_def: &ErrorDefinition) -> utoipa::openapi::Object {
        let mut context = utoipa::openapi::Object::new();
        context.title = Some(format!("{}Context", error_def.get_schema_name()));
        // We write openapi properties by alpha order, to keep the same yml file
        for prop_name in error_def.get_context().keys().sorted() {
            let prop_type = &error_def.get_context()[prop_name];
            let utoipa_type = match prop_type.as_ref() {
                "bool" => utoipa::openapi::schema::Type::Boolean,
                "isize" | "i8" | "i16" | "i32" | "i64" | "usize" | "u8" | "u16" | "u32" | "u64" => {
                    utoipa::openapi::schema::Type::Integer
                }
                "f8" | "f16" | "f32" | "f64" => utoipa::openapi::schema::Type::Number,
                "Vec" => utoipa::openapi::schema::Type::Array,
                "char" | "String" => utoipa::openapi::schema::Type::String,
                _ => utoipa::openapi::schema::Type::Object,
            };
            context.properties.insert(
                prop_name.clone(),
                utoipa::openapi::ObjectBuilder::new()
                    .schema_type(utoipa::openapi::schema::SchemaType::Type(utoipa_type))
                    .into(),
            );
            context.required.push(prop_name.clone());
        }
        context
    }

    // Add errors in openapi schema
    fn add_errors_in_schema(openapi: &mut utoipa::openapi::OpenApi) {
        // Building the generic editoast error
        let mut editoast_error = utoipa::openapi::OneOf::new();
        editoast_error.description = Some("Generated error type for Editoast".to_string());
        editoast_error.discriminator = Some(utoipa::openapi::Discriminator::new("type"));

        // Adding all error type to openapi
        // alpha sorted by name, to keep the same file (there is no order guarantee with inventory)
        let mut errors: Vec<&ErrorDefinition> = vec![];
        for error_def in inventory::iter::<ErrorDefinition> {
            errors.push(error_def);
        }
        errors.sort_by(|a, b| a.namespace.cmp(b.namespace).then(a.id.cmp(b.id)));
        for error_def in errors {
            openapi.components.as_mut().unwrap().schemas.insert(
                error_def.get_schema_name(),
                utoipa::openapi::ObjectBuilder::new()
                    .property(
                        "type",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::schema::SchemaType::Type(
                                utoipa::openapi::schema::Type::String,
                            ))
                            .enum_values(Some([error_def.id])),
                    )
                    .property(
                        "status",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::schema::SchemaType::Type(
                                utoipa::openapi::schema::Type::Integer,
                            ))
                            .enum_values(Some([error_def.status])),
                    )
                    .property(
                        "message",
                        utoipa::openapi::ObjectBuilder::new().schema_type(
                            utoipa::openapi::schema::SchemaType::Type(
                                utoipa::openapi::schema::Type::String,
                            ),
                        ),
                    )
                    .property("context", Self::error_context_to_openapi_object(error_def))
                    .required("type")
                    .required("status")
                    .required("message")
                    .into(),
            );

            // Adding the ref of the error to the generic error
            editoast_error.items.push(
                utoipa::openapi::Ref::new(format!(
                    "#/components/schemas/{}",
                    error_def.get_schema_name()
                ))
                .into(),
            );
        }

        // Adding generic error to openapi
        openapi.components.as_mut().unwrap().schemas.insert(
            String::from("EditoastError"),
            utoipa::openapi::OneOfBuilder::from(editoast_error).into(),
        );
    }

    fn insert_routes(openapi: &mut utoipa::openapi::OpenApi) -> Vec<(String, RefOr<Schema>)> {
        let flattened_paths = service_router()
            .path_trees
            .into_iter()
            .flat_map(|t| t.flatten());
        let mut all_schemas = Vec::new();
        for FlattenedPath {
            path_segments,
            path_item,
            schemas,
        } in flattened_paths
        {
            let mut path = path_segments
                .into_iter()
                .map(String::from)
                .fold(String::new(), concat_path);
            // We are required by axum to have trailing slashes in the `Router`s.
            // But that's not OpenApi compliant, so we remove them here.
            if path.ends_with('/') {
                path = path.trim_end_matches('/').to_string();
            }
            debug!("processing {path}");
            if openapi.paths.paths.contains_key(&path) {
                let existing_path_item = openapi.paths.paths.remove(&path).unwrap();
                let merged = merge_path_items(existing_path_item, path_item);
                openapi.paths.paths.insert(path, merged);
            } else {
                openapi.paths.paths.insert(path, path_item);
            }
            all_schemas.extend(schemas);
        }
        all_schemas
    }

    fn insert_schemas(
        openapi: &mut utoipa::openapi::OpenApi,
        routes_schemas: Vec<(String, RefOr<Schema>)>,
    ) {
        if openapi.components.is_none() {
            openapi.components = Some(Default::default());
        }
        let schemas = &mut openapi.components.as_mut().unwrap().schemas;
        // Insert automatically collected schemas from routes
        for (name, schema) in routes_schemas {
            schemas.entry(name).or_insert(schema);
        }
    }

    // Remove the operation_id that defaults to the endpoint function name
    // so that it doesn't override the RTK methods names.
    fn remove_operation_id(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for operation in path_item_operations_mut(endpoint) {
                operation.operation_id = None;
            }
        }
    }

    pub fn build_openapi() -> utoipa::openapi::OpenApi {
        let mut openapi = OpenApiRoot::openapi();
        let routes_schemas = Self::insert_routes(&mut openapi);
        Self::insert_schemas(&mut openapi, routes_schemas);
        Self::add_errors_in_schema(&mut openapi);
        Self::remove_operation_id(&mut openapi);
        set_patch_operation_titles(&mut openapi);
        set_search_query_titles(&mut openapi);
        check_variant_titles(&openapi);
        openapi
    }
}

// Returns the oneOf schema for the given name, or panics.
fn get_one_of_schema_mut<'a>(
    openapi: &'a mut utoipa::openapi::OpenApi,
    name: &str,
) -> &'a mut OneOf {
    let schemas = &mut openapi
        .components
        .as_mut()
        .expect("openapi components should always be present")
        .schemas;
    let Some(RefOr::T(Schema::OneOf(one_of))) = schemas.get_mut(name) else {
        panic!("openapi: expected '{name}' schema to be a oneOf");
    };
    one_of
}

// Sets titles on `PatchOperation`'s oneOf variants.
// `PatchOperation` is from the `json_patch` crate so we can't use `#[schema(title_variants)]`.
fn set_patch_operation_titles(openapi: &mut utoipa::openapi::OpenApi) {
    let one_of = get_one_of_schema_mut(openapi, "PatchOperation");
    for item in &mut one_of.items {
        if let RefOr::T(Schema::AllOf(all_of)) = item
            && let Some(RefOr::Ref(r)) = all_of.items.first()
        {
            let name = r.ref_location.rsplit('/').next().unwrap_or_else(|| {
                panic!(
                    "openapi: malformed $ref in PatchOperation: '{}'",
                    r.ref_location
                )
            });
            all_of.title = Some(format!("PatchOperation{name}"));
        }
    }
}

// Sets titles on `SearchQuery`'s oneOf variants.
// The `Array` variant uses `#[schema(value_type = Object)]` which drops the title.
fn set_search_query_titles(openapi: &mut utoipa::openapi::OpenApi) {
    let one_of = get_one_of_schema_mut(openapi, "SearchQuery");
    for item in &mut one_of.items {
        if let RefOr::T(Schema::Object(obj)) = item
            && obj.title.is_none()
        {
            obj.title = Some("SearchQueryArray".to_string());
        }
    }
}

// Checks that every oneOf/anyOf variant in all schemas has a unique title.
// Panics if a title is missing, duplicated, or if components is missing.
fn check_variant_titles(openapi: &utoipa::openapi::OpenApi) {
    let components = openapi.components.as_ref().unwrap();
    // Every root schema name becomes a generated class name in codegen,
    // so reserve all of them up front to catch any variant title that clashes.
    let mut seen_titles: BTreeMap<&str, &str> = components
        .schemas
        .keys()
        .map(|name| (name.as_str(), name.as_str()))
        .collect();
    for (schema_name, schema) in &components.schemas {
        check_schema_titles(schema, schema_name, &mut seen_titles);
    }
}

// Recurses into a schema to check titles on oneOf/anyOf variants.
fn check_schema_titles<'a>(
    schema: &'a RefOr<Schema>,
    component_schema_name: &'a str,
    seen_titles: &mut BTreeMap<&'a str, &'a str>,
) {
    let RefOr::T(schema) = schema else { return };
    match schema {
        Schema::OneOf(utoipa::openapi::schema::OneOf { items, .. })
        | Schema::AnyOf(utoipa::openapi::schema::AnyOf { items, .. }) => {
            check_item_titles(items, component_schema_name, seen_titles)
        }
        Schema::AllOf(all_of) => {
            // allOf items are composition, not discrimination — no title required on the items
            // themselves, but recurse to find nested oneOf/anyOf.
            for item in &all_of.items {
                check_schema_titles(item, component_schema_name, seen_titles);
            }
        }
        Schema::Object(obj) => {
            for prop in obj.properties.values() {
                check_schema_titles(prop, component_schema_name, seen_titles);
            }
            if let Some(additional) = &obj.additional_properties
                && let AdditionalProperties::RefOr(schema) = additional.as_ref()
            {
                check_schema_titles(schema, component_schema_name, seen_titles);
            }
        }
        Schema::Array(arr) => {
            if let ArrayItems::RefOrSchema(schema) = &arr.items {
                check_schema_titles(schema, component_schema_name, seen_titles);
            }
        }
        // Schema is #[non_exhaustive], so the wildcard is required by the compiler.
        &_ => {}
    }
}

// For each inline (non-$ref) item in a oneOf/anyOf, checks that a title exists
// and is unique, then recurses into the item.
fn check_item_titles<'a>(
    items: &'a [RefOr<Schema>],
    component_schema_name: &'a str,
    seen_titles: &mut BTreeMap<&'a str, &'a str>,
) {
    let inline_schemas: Vec<&Schema> = items
        .iter()
        .filter_map(|item| {
            if let RefOr::T(s) = item {
                Some(s)
            } else {
                None
            }
        })
        .collect();

    let (titled, untitled): (Vec<_>, Vec<_>) = inline_schemas
        .iter()
        .copied()
        .filter(|s| !matches!(s, Schema::Object(obj) if obj.schema_type == SchemaType::Type(Type::Null)))
        .partition_map(|s| match get_title(s) {
            Some(title) => Either::Left(title),
            None => Either::Right(s),
        });

    // Require titles when there are 2+ non-null items and any of them has no title.
    if titled.len() + untitled.len() >= 2 && !untitled.is_empty() {
        panic!(
            "openapi: a oneOf/anyOf item inside schema '{component_schema_name}' has no title. \
            Add #[schema(title_variants)] on the enum or \
            #[schema(title = \"...\")] on the specific variant."
        );
    }

    // Register titles only after the pre-condition is satisfied.
    for title in &titled {
        if let Some(prev) = seen_titles.insert(title, component_schema_name) {
            panic!(
                "openapi: duplicate title '{title}' in schemas '{prev}' and '{component_schema_name}'. \
                    Override with #[schema(title = \"...\")] on one of the conflicting variants."
            );
        }
    }

    // Recurse into all items (including $refs and null).
    for item in items {
        check_schema_titles(item, component_schema_name, seen_titles);
    }
}

// Returns the title of an inline schema, or None if it has no title.
fn get_title(schema: &Schema) -> Option<&str> {
    match schema {
        Schema::Object(obj) => obj.title.as_deref(),
        Schema::AllOf(AllOf { title, .. }) | Schema::OneOf(OneOf { title, .. }) => title.as_deref(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use utoipa::openapi::ObjectBuilder;
    use utoipa::openapi::OneOfBuilder;
    use utoipa::openapi::OpenApi;
    use utoipa::openapi::schema::AllOfBuilder;
    use utoipa::openapi::schema::OneOf;

    use super::*;

    fn variant(title: &str) -> Schema {
        Schema::Object(ObjectBuilder::new().title(Some(title)).build())
    }

    fn make_two_variant_one_of(t1: &str, t2: &str) -> OneOf {
        OneOfBuilder::new()
            .item(variant(t1))
            .item(variant(t2))
            .build()
    }

    fn build_openapi_with_schema(name: &str, schema: Schema) -> OpenApi {
        let mut openapi = OpenApiRoot::build_openapi();
        openapi
            .components
            .as_mut()
            .unwrap()
            .schemas
            .insert(name.to_string(), schema.into());
        openapi
    }

    #[test]
    fn openapi_building_goes_well() {
        let _ = OpenApiRoot::build_openapi(); // panics if something is wrong
    }

    #[test]
    fn valid_titles_pass_validation() {
        let waypoint_schema = make_two_variant_one_of("WaypointBufferStop", "WaypointDetector");
        let openapi = build_openapi_with_schema("Waypoint", Schema::OneOf(waypoint_schema));
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "has no title")]
    fn missing_title_fails_validation() {
        let variant_without_title = Schema::Object(ObjectBuilder::new().build());
        let variant_with_title = Schema::Object(
            ObjectBuilder::new()
                .title(Some("WaypointBufferStop"))
                .build(),
        );
        let waypoint_schema = OneOfBuilder::new()
            .item(variant_without_title)
            .item(variant_with_title)
            .build();
        let openapi = build_openapi_with_schema("Waypoint", Schema::OneOf(waypoint_schema));
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "duplicate title")]
    fn duplicate_title_fails_validation() {
        let waypoint_schema = make_two_variant_one_of("WaypointBufferStop", "WaypointBufferStop");
        let openapi = build_openapi_with_schema("Waypoint", Schema::OneOf(waypoint_schema));
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "has no title")]
    fn nested_one_of_missing_title_fails_validation() {
        // inner oneOf has one untitled item — this should be caught
        let inner_variant_without_title = Schema::Object(ObjectBuilder::new().build());
        let inner_variant_with_title = Schema::Object(
            ObjectBuilder::new()
                .title(Some("WaypointKindBufferStop"))
                .build(),
        );
        let inner_waypoint_schema = OneOfBuilder::new()
            .item(inner_variant_without_title)
            .item(inner_variant_with_title)
            .build();
        // outer oneOf wraps the allOf so the nested oneOf is reachable
        let outer_variant1 = variant("WaypointKindDetector");
        let outer_variant2 = variant("WaypointKindWaypoint");
        let outer_all_of = AllOfBuilder::new()
            .item(outer_variant1)
            .item(Schema::OneOf(inner_waypoint_schema))
            .build();
        let outer_waypoint_schema = OneOfBuilder::new()
            .item(Schema::AllOf(outer_all_of))
            .item(outer_variant2)
            .build();
        let openapi =
            build_openapi_with_schema("WaypointKind", Schema::OneOf(outer_waypoint_schema));
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "duplicate title")]
    fn duplicate_title_across_schemas_fails_validation() {
        let var = OneOfBuilder::new()
            .item(variant("WaypointBufferStop"))
            .build();
        let waypoint_schema = make_two_variant_one_of("WaypointBufferStop", "WaypointDetector");
        let mut openapi = OpenApiRoot::build_openapi();
        let schemas = &mut openapi.components.as_mut().unwrap().schemas;
        schemas.insert(
            "Waypoint".to_string(),
            Schema::OneOf(waypoint_schema).into(),
        );
        schemas.insert("Waypoint2".to_string(), Schema::OneOf(var).into());
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "duplicate title")]
    fn single_item_one_of_name_conflicts_with_variant_title() {
        // "Waypoint" is a single-item oneOf (wrapper) — codegen names it "Waypoint".
        // "WaypointKind" has a variant titled "Waypoint" — conflict.
        let wrapper_schema = OneOfBuilder::new()
            .item(Schema::Object(ObjectBuilder::new().build()))
            .build();
        let kind_schema = make_two_variant_one_of("WaypointKindBufferStop", "Waypoint");
        let mut openapi = OpenApiRoot::build_openapi();
        let schemas = &mut openapi.components.as_mut().unwrap().schemas;
        schemas.insert("Waypoint".to_string(), Schema::OneOf(wrapper_schema).into());
        schemas.insert(
            "WaypointKind".to_string(),
            Schema::OneOf(kind_schema).into(),
        );
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "has no title")]
    fn multi_variant_one_of_without_titles_fails_validation() {
        let schema = OneOfBuilder::new()
            .item(Schema::Object(ObjectBuilder::new().build()))
            .item(Schema::Object(ObjectBuilder::new().build()))
            .build();
        let openapi = build_openapi_with_schema("Waypoint", Schema::OneOf(schema));
        check_variant_titles(&openapi);
    }

    #[test]
    #[should_panic(expected = "duplicate title")]
    fn root_schema_name_used_as_variant_title_fails_validation() {
        // "TrackSection" is a plain object schema (not a oneOf) — its name still becomes a class in codegen.
        // "Waypoint" has a variant titled "TrackSection" — that clashes with the "TrackSection" class name.
        let mut openapi = OpenApiRoot::build_openapi();
        let schemas = &mut openapi.components.as_mut().unwrap().schemas;
        schemas.insert(
            "Detector".to_string(),
            Schema::Object(ObjectBuilder::new().build()).into(),
        );
        schemas.insert(
            "Waypoint".to_string(),
            Schema::OneOf(make_two_variant_one_of("BufferStop", "Detector")).into(),
        );
        check_variant_titles(&openapi);
    }
}
