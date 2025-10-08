use std::collections::BTreeMap;

use itertools::Itertools as _;
use tracing::debug;
use utoipa::OpenApi;
use utoipa::openapi::HttpMethod;
use utoipa::openapi::PathItem;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;
use utoipa::openapi::path::Operation;
use utoipa::openapi::path::PathItemBuilder;

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
        openapi
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openapi_building_goes_well() {
        let _ = OpenApiRoot::build_openapi(); // panics if something is wrong
    }
}
