use std::collections::HashMap;

use axum::http;
use axum::response::IntoResponse as _;
use itertools::Itertools;
use utoipa::openapi::ContentBuilder;
use utoipa::openapi::KnownFormat;
use utoipa::openapi::ObjectBuilder;
use utoipa::openapi::OneOfBuilder;
use utoipa::openapi::RefOr;
use utoipa::openapi::ResponseBuilder;
use utoipa::openapi::ResponsesBuilder;
use utoipa::openapi::Schema;
use utoipa::openapi::SchemaFormat;
use utoipa::openapi::Type;
use utoipa::openapi::schema::SchemaType;

/// Describes a view error and provides the necessary information to build the API response
///
/// Not meant to be implemented directly. Use the `derive(ViewError)` proc-macro instead.
pub(crate) trait ViewError: std::error::Error + utoipa::IntoResponses + Sized {
    const LABEL: &'static str;

    fn responses() -> Vec<OpenApiResponse>;
    fn status(&self) -> http::StatusCode;
    fn context(self) -> HashMap<String, serde_json::Value>;
    /// If the error type is an enum, return the error label of each error variant, or `None` otherwise
    fn sub_label(&self) -> Option<&'static str>;

    fn unique_label(&self) -> String {
        if let Some(variant_label) = self.sub_label() {
            format!("editoast::{}::{}", Self::LABEL, variant_label)
        } else {
            format!("editoast::{}", Self::LABEL)
        }
    }

    fn utoipa_responses() -> utoipa::openapi::Responses {
        let base = format!("editoast::{}", Self::LABEL);

        let responses = <Self as ViewError>::responses()
            .into_iter()
            .into_group_map_by(|res| res.status)
            .into_iter()
            .map(|(code, responses)| {
                let schema = responses
                    .into_iter()
                    .fold(OneOfBuilder::new(), |builder, response| {
                        builder.item(response.as_schema(&base, code.as_str()))
                    });
                let response = ResponseBuilder::new()
                    .content(
                        "application/json",
                        ContentBuilder::new().schema(Some(schema)).build(),
                    )
                    .build();
                (code.as_str().to_owned(), response)
            });
        ResponsesBuilder::new()
            .responses_from_iter(responses)
            .build()
    }

    fn into_response(self) -> axum::response::Response {
        EditoastError::from(self).into_response()
    }
}

#[derive(Debug, serde::Serialize)]
pub(crate) struct EditoastError {
    pub(crate) r#type: String,
    #[serde(with = "crate::error::StatusCodeRemoteDef")]
    pub(crate) status: http::StatusCode,
    pub(crate) message: String,
    pub(crate) context: HashMap<String, serde_json::Value>,
}

impl<T: ViewError> From<T> for EditoastError {
    fn from(error: T) -> Self {
        Self {
            r#type: error.unique_label(),
            status: error.status(),
            message: error.to_string(),
            context: error.context(),
        }
    }
}

impl axum::response::IntoResponse for EditoastError {
    fn into_response(self) -> axum::response::Response {
        (self.status, axum::Json(self)).into_response()
    }
}

pub(crate) struct OpenApiResponse {
    pub(crate) label: Option<&'static str>,
    pub(crate) status: http::StatusCode,
    pub(crate) message_template: Option<&'static str>,
    pub(crate) context: Vec<ContextEntry>,
}

pub(crate) struct ContextEntry {
    pub(crate) key: &'static str,
    pub(crate) schema: RefOr<Schema>,
}

impl OpenApiResponse {
    fn as_schema(&self, base_error_type: &str, status: &str) -> RefOr<Schema> {
        let context = self
            .context
            .iter()
            .fold(ObjectBuilder::new(), |builder, entry| {
                builder
                    .property(entry.key.to_owned(), entry.schema.clone())
                    .required(entry.key.to_owned())
            })
            .build();
        let unique_label = format!(
            "{}{}",
            base_error_type,
            self.label.map(|v| format!("::{v}")).unwrap_or_default()
        );
        RefOr::T(Schema::Object(
            ObjectBuilder::new()
                .description(self.message_template)
                .property(
                    "error_type",
                    ObjectBuilder::new()
                        .schema_type(SchemaType::Type(Type::String))
                        .enum_values(Some([unique_label])),
                )
                .required("error_type")
                .property(
                    "status",
                    ObjectBuilder::new()
                        .schema_type(SchemaType::Type(Type::Integer))
                        .format(Some(SchemaFormat::KnownFormat(KnownFormat::Int32)))
                        .enum_values(Some([status])),
                )
                .required("status")
                .property(
                    "message",
                    ObjectBuilder::new().schema_type(SchemaType::Type(Type::String)),
                )
                .required("message")
                .property("context", RefOr::T(Schema::Object(context)))
                .required("context")
                .build(),
        ))
    }
}
