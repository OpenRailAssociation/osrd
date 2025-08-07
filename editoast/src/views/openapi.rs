use std::collections::BTreeMap;

use itertools::Itertools as _;
use tracing::debug;
use tracing::warn;
use utoipa::OpenApi;
use utoipa::openapi::AllOf;
use utoipa::openapi::Array;
use utoipa::openapi::Object;
use utoipa::openapi::OneOf;
use utoipa::openapi::PathItem;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;
use utoipa::openapi::path::PathItemBuilder;
use utoipa::openapi::schema::AnyOf;

use crate::error::ErrorDefinition;
use crate::views::service_router;

fn concat_path<A: AsRef<str>, B: AsRef<str>>(a: A, b: B) -> String {
    let (a, b) = (a.as_ref(), b.as_ref());
    match (a.ends_with('/'), b.starts_with('/')) {
        (true, true) => format!("{}{}", a, &b[1..]),
        _ => format!("{a}{b}"),
    }
}

fn merge_path_items(a: PathItem, b: PathItem) -> PathItem {
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

fn remove_discriminator(schema: &mut RefOr<Schema>) {
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

#[derive(OpenApi)]
#[openapi(info(
    title = "OSRD Editoast",
    description = "All HTTP endpoints of Editoast",
    license(name = "LGPL", url = "https://www.gnu.org/licenses/lgpl-3.0.html"),
))]
pub struct OpenApiRoot;

impl OpenApiRoot {
    // RTK doesn't support the discriminator: property everywhere utoipa
    // puts it. So we remove it, even though utoipa is correct.
    fn remove_discrimators(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                if let Some(request_body) = operation.request_body.as_mut() {
                    for (_, content) in request_body.content.iter_mut() {
                        remove_discriminator(&mut content.schema);
                    }
                }
                for (_, response) in operation.responses.responses.iter_mut() {
                    match response {
                        RefOr::T(response) => {
                            for (_, content) in response.content.iter_mut() {
                                remove_discriminator(&mut content.schema);
                            }
                        }
                        RefOr::Ref { .. } => panic!("editoast doesn't support response references"),
                    }
                }
            }
        }
        if let Some(components) = openapi.components.as_mut() {
            for component in components.schemas.values_mut() {
                remove_discriminator(component);
            }
        }
    }

    // utoipa::path doesn't support multiple tags, so this is a hack to split them
    // A PR on utoipa might be a good idea
    // Split comma-separated tags into multiple tags
    fn split_tags(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                operation.tags = operation.tags.as_ref().map(|tags| {
                    tags.iter()
                        .flat_map(|tag| tag.split(','))
                        .map(|tag| tag.trim().to_owned())
                        .collect()
                });
            }
        }
    }

    fn error_context_to_openapi_object(error_def: &ErrorDefinition) -> utoipa::openapi::Object {
        let mut context = utoipa::openapi::Object::new();
        // We write openapi properties by alpha order, to keep the same yml file
        for prop_name in error_def.get_context().keys().sorted() {
            let prop_type = &error_def.get_context()[prop_name];
            context.properties.insert(
                prop_name.clone(),
                utoipa::openapi::ObjectBuilder::new()
                    .schema_type(match prop_type.as_ref() {
                        "bool" => utoipa::openapi::SchemaType::Boolean,
                        "isize" => utoipa::openapi::SchemaType::Integer,
                        "i8" => utoipa::openapi::SchemaType::Integer,
                        "i16" => utoipa::openapi::SchemaType::Integer,
                        "i32" => utoipa::openapi::SchemaType::Integer,
                        "i64" => utoipa::openapi::SchemaType::Integer,
                        "usize" => utoipa::openapi::SchemaType::Integer,
                        "u8" => utoipa::openapi::SchemaType::Integer,
                        "u16" => utoipa::openapi::SchemaType::Integer,
                        "u32" => utoipa::openapi::SchemaType::Integer,
                        "u64" => utoipa::openapi::SchemaType::Integer,
                        "f8" => utoipa::openapi::SchemaType::Number,
                        "f16" => utoipa::openapi::SchemaType::Number,
                        "f32" => utoipa::openapi::SchemaType::Number,
                        "f64" => utoipa::openapi::SchemaType::Number,
                        "Vec" => utoipa::openapi::SchemaType::Array,
                        "char" => utoipa::openapi::SchemaType::String,
                        "String" => utoipa::openapi::SchemaType::String,
                        _ => utoipa::openapi::SchemaType::Object,
                    })
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
                            .schema_type(utoipa::openapi::SchemaType::String)
                            .enum_values(Some([error_def.id])),
                    )
                    .property(
                        "status",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::SchemaType::Integer)
                            .enum_values(Some([error_def.status])),
                    )
                    .property(
                        "message",
                        utoipa::openapi::ObjectBuilder::new()
                            .schema_type(utoipa::openapi::SchemaType::String),
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

    fn insert_routes(openapi: &mut utoipa::openapi::OpenApi) {
        let paths = service_router()
            .path_trees
            .into_iter()
            .flat_map(|t| t.flatten())
            .map(|(parts, item)| {
                (
                    parts
                        .into_iter()
                        .map(String::from)
                        .fold(String::new(), concat_path),
                    item,
                )
            });
        for (mut path, path_item) in paths {
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
        }
    }

    fn insert_schemas(openapi: &mut utoipa::openapi::OpenApi) {
        if openapi.components.is_none() {
            openapi.components = Some(Default::default());
        }
        let schemas = &mut openapi.components.as_mut().unwrap().schemas;
        schemas.extend(crate::views::schemas());
        schemas.extend(editoast_common::OPENAPI_SCHEMAS.iter().map(|f| {
            let (name, schema) = f();
            (name.to_string(), schema)
        }));
    }

    // Remove the operation_id that defaults to the endpoint function name
    // so that it doesn't override the RTK methods names.
    fn remove_operation_id(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                operation.operation_id = None;
                // By default utoipa adds a tag "crate" to operations that don't have
                // any. That causes problems with RTK tag management.
                match &operation.tags {
                    Some(tags) if tags.len() == 1 && tags.first().unwrap() == "crate" => {
                        operation.tags = None;
                    }
                    _ => (),
                }
            }
        }
    }

    pub fn build_openapi() -> utoipa::openapi::OpenApi {
        let mut openapi = OpenApiRoot::openapi();
        Self::insert_routes(&mut openapi);
        Self::insert_schemas(&mut openapi);
        Self::remove_discrimators(&mut openapi);
        Self::split_tags(&mut openapi);
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
