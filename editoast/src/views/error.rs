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
    fn responses() -> Vec<OpenApiResponse>;
    fn label(&self) -> &'static str;
    fn status(&self) -> http::StatusCode;
    fn context(self) -> HashMap<String, serde_json::Value>;
    /// If the error type is an enum, return the error label of each error variant, or `None` otherwise
    fn sub_label(&self) -> Option<&'static str>;

    fn unique_label(&self) -> String {
        if let Some(variant_label) = self.sub_label() {
            format!("editoast::{}::{}", self.label(), variant_label)
        } else {
            format!("editoast::{}", self.label())
        }
    }

    fn utoipa_responses() -> utoipa::openapi::Responses {
        let responses = <Self as ViewError>::responses()
            .into_iter()
            .into_group_map_by(|res| res.status)
            .into_iter()
            .map(|(code, responses)| {
                let schema = responses
                    .into_iter()
                    .fold(OneOfBuilder::new(), |builder, response| {
                        builder.item(response.as_schema(code.as_str()))
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
#[cfg_attr(test, derive(PartialEq, Eq))]
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
    pub(crate) label: &'static str,
    pub(crate) sub_label: Option<&'static str>,
    pub(crate) status: http::StatusCode,
    pub(crate) message_template: Option<&'static str>,
    pub(crate) context: Vec<ContextEntry>,
}

pub(crate) struct ContextEntry {
    pub(crate) key: &'static str,
    pub(crate) schema: RefOr<Schema>,
}

impl OpenApiResponse {
    fn as_schema(&self, status: &str) -> RefOr<Schema> {
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
            "editoast::{}{}",
            self.label,
            self.sub_label
                .map(|label| format!("::{label}"))
                .unwrap_or_default()
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

#[cfg(test)]
mod tests {
    use super::*;

    use editoast_derive::ViewError;

    impl EditoastError {
        fn new(r#type: &str, status: u16, message: &str) -> Self {
            Self {
                r#type: r#type.to_string(),
                status: http::StatusCode::from_u16(status).unwrap(),
                message: message.to_string(),
                context: Default::default(),
            }
        }

        fn context(mut self, key: &str, value: impl serde::Serialize) -> Self {
            self.context
                .insert(key.to_string(), serde_json::to_value(value).unwrap());
            self
        }
    }

    mod unit_struct {
        use super::*;

        use pretty_assertions::assert_eq;

        #[test]
        fn default() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("ohno")]
            struct Unit;

            assert_eq!(
                EditoastError::from(Unit),
                EditoastError::new("editoast::Unit", 500, "ohno")
            );
        }

        #[test]
        fn attributes() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("ohno")]
            #[view_error(name = "custom", status = NOT_FOUND, context)]
            struct Unit;

            assert_eq!(
                EditoastError::from(Unit),
                EditoastError::new("editoast::custom", 404, "ohno")
            );
        }
    }

    mod newtype {
        use super::*;

        use pretty_assertions::assert_eq;

        #[test]
        fn attributes_and_context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("value: {0}")]
            #[view_error(name = "custom", status = UNAUTHORIZED, context)]
            struct Newtype(String);

            assert_eq!(
                EditoastError::from(Newtype("foo".to_owned())),
                EditoastError::new("editoast::custom", 401, "value: foo").context("0", "foo")
            );
        }

        #[test]
        fn transparent_source_is_excluded_from_context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error(transparent)]
            #[view_error(context)]
            struct Transparent(#[from] std::io::Error);

            assert_eq!(
                EditoastError::from(Transparent(std::io::Error::other("io failure"))),
                EditoastError::new("editoast::Transparent", 500, "io failure")
            );
        }

        #[test]
        fn forwarded_view_error() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("inner error: {detail}")]
            #[view_error(name = "inner", status = IM_A_TEAPOT, context)]
            struct InnerError {
                detail: String,
            }

            #[derive(Debug, thiserror::Error, ViewError)]
            #[error(transparent)]
            struct Wrapper(#[view_error] InnerError);

            assert_eq!(
                EditoastError::from(Wrapper(InnerError {
                    detail: "forwarded".to_owned(),
                })),
                EditoastError::new("editoast::inner", 418, "inner error: forwarded")
                    .context("detail", "forwarded")
            );
        }

        #[test]
        fn forwarded_view_error_preserves_sub_label() {
            #[derive(Debug, thiserror::Error, ViewError)]
            enum Inner {
                #[error("inner variant")]
                Variant,
            }

            #[derive(Debug, thiserror::Error, ViewError)]
            #[error(transparent)]
            struct Wrapper(#[view_error] Inner);

            assert_eq!(
                EditoastError::from(Wrapper(Inner::Variant)),
                EditoastError::new("editoast::Inner::Variant", 500, "inner variant")
            );
        }
    }

    mod tuple {
        use super::*;

        use pretty_assertions::assert_eq;

        #[test]
        fn context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("tuple: {0}, {1}")]
            #[view_error(name = "custom", status = BAD_REQUEST, context)]
            struct Tuple(String, u32);

            assert_eq!(
                EditoastError::from(Tuple("foo".to_string(), 42)),
                EditoastError::new("editoast::custom", 400, "tuple: foo, 42")
                    .context("0", "foo")
                    .context("1", 42)
            );
        }

        #[test]
        fn source_is_excluded_from_context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("tuple error: {1}")]
            #[view_error(context)]
            struct Tuple(#[source] std::io::Error, String);

            assert_eq!(
                EditoastError::from(Tuple(
                    std::io::Error::other("io failure"),
                    "context".to_owned(),
                )),
                EditoastError::new("editoast::Tuple", 500, "tuple error: context")
                    .context("1", "context")
            );
        }

        #[test]
        fn forwarded_view_error_with_additional_field() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("inner error: {detail}")]
            #[view_error(name = "inner", status = IM_A_TEAPOT, context)]
            struct InnerError {
                detail: String,
            }

            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("{0}")]
            struct Wrapper(#[view_error] InnerError, String);

            assert_eq!(
                EditoastError::from(Wrapper(
                    InnerError {
                        detail: "forwarded".to_owned(),
                    },
                    "ignored".to_owned(),
                )),
                EditoastError::new("editoast::inner", 418, "inner error: forwarded")
                    .context("detail", "forwarded")
            );
        }
    }

    mod named {
        use super::*;

        use pretty_assertions::assert_eq;

        #[test]
        fn attributes_and_context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("incident {incident_id}: {cause}; fix: {fix}")]
            #[view_error(name = "custom", status = SERVICE_UNAVAILABLE, context)]
            struct Named {
                cause: String,
                fix: String,
                incident_id: u64,
            }

            assert_eq!(
                EditoastError::from(Named {
                    cause: "failure".to_owned(),
                    fix: "retry".to_owned(),
                    incident_id: 42,
                }),
                EditoastError::new("editoast::custom", 503, "incident 42: failure; fix: retry",)
                    .context("cause", "failure")
                    .context("fix", "retry")
                    .context("incident_id", 42)
            );
        }

        #[test]
        fn implicit_source_is_excluded_from_context() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("named error: {context}")]
            #[view_error(context)]
            struct Named {
                source: std::io::Error,
                context: String,
            }

            assert_eq!(
                EditoastError::from(Named {
                    source: std::io::Error::other("io failure"),
                    context: "details".to_owned(),
                }),
                EditoastError::new("editoast::Named", 500, "named error: details")
                    .context("context", "details")
            );
        }

        #[test]
        fn forwarded_view_error_with_additional_field() {
            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("inner error: {detail}")]
            #[view_error(name = "inner", status = IM_A_TEAPOT, context)]
            struct InnerError {
                detail: String,
            }

            #[derive(Debug, thiserror::Error, ViewError)]
            #[error("{inner}")]
            struct Wrapper {
                #[view_error]
                inner: InnerError,
                ignored: String,
            }

            assert_eq!(
                EditoastError::from(Wrapper {
                    inner: InnerError {
                        detail: "forwarded".to_owned(),
                    },
                    ignored: "ignored".to_owned(),
                }),
                EditoastError::new("editoast::inner", 418, "inner error: forwarded")
                    .context("detail", "forwarded")
            );
        }
    }

    mod enums {
        use super::*;

        mod c_like {
            use super::*;

            use pretty_assertions::assert_eq;

            #[test]
            fn variants() {
                #[derive(Debug, thiserror::Error, ViewError)]
                #[view_error(name = "color")]
                enum Color {
                    #[error("red")]
                    Red,
                    #[error("green")]
                    Green,
                    #[error("blue")]
                    Blue,
                }

                assert_eq!(
                    EditoastError::from(Color::Red),
                    EditoastError::new("editoast::color::Red", 500, "red")
                );
                assert_eq!(
                    EditoastError::from(Color::Green),
                    EditoastError::new("editoast::color::Green", 500, "green")
                );
                assert_eq!(
                    EditoastError::from(Color::Blue),
                    EditoastError::new("editoast::color::Blue", 500, "blue")
                );
            }
        }

        mod mixed {
            use super::*;

            use pretty_assertions::assert_eq;

            #[test]
            fn variants() {
                #[derive(Debug, thiserror::Error, ViewError)]
                #[view_error(name = "mixed", context)]
                enum Mixed {
                    #[error("unit")]
                    Unit,
                    #[error("newtype: {0}")]
                    #[view_error(status = BAD_REQUEST)]
                    Newtype(String),
                    #[error("tuple: {0}, {1}")]
                    Tuple(String, u32),
                    #[error("incident {incident_id}: {cause}")]
                    Rich { cause: String, incident_id: u64 },
                }

                assert_eq!(
                    EditoastError::from(Mixed::Unit),
                    EditoastError::new("editoast::mixed::Unit", 500, "unit")
                );
                assert_eq!(
                    EditoastError::from(Mixed::Newtype("foo".to_owned())),
                    EditoastError::new("editoast::mixed::Newtype", 400, "newtype: foo")
                        .context("0", "foo")
                );
                assert_eq!(
                    EditoastError::from(Mixed::Tuple("foo".to_owned(), 42)),
                    EditoastError::new("editoast::mixed::Tuple", 500, "tuple: foo, 42")
                        .context("0", "foo")
                        .context("1", 42)
                );
                assert_eq!(
                    EditoastError::from(Mixed::Rich {
                        cause: "failure".to_owned(),
                        incident_id: 42,
                    }),
                    EditoastError::new("editoast::mixed::Rich", 500, "incident 42: failure",)
                        .context("cause", "failure")
                        .context("incident_id", 42)
                );
            }

            #[test]
            fn sources_are_excluded_from_context() {
                #[derive(Debug, thiserror::Error, ViewError)]
                #[view_error(context)]
                enum Sources {
                    #[error("implicit source: {context}")]
                    Implicit {
                        source: std::io::Error,
                        context: String,
                    },
                    #[error("explicit source: {context}")]
                    Explicit {
                        #[source]
                        error: std::io::Error,
                        context: String,
                    },
                    #[error("from: {0}")]
                    From(#[from] std::io::Error),
                    #[error(transparent)]
                    Transparent(std::io::Error),
                }

                assert_eq!(
                    EditoastError::from(Sources::Implicit {
                        source: std::io::Error::other("io failure"),
                        context: "details".to_owned(),
                    }),
                    EditoastError::new(
                        "editoast::Sources::Implicit",
                        500,
                        "implicit source: details",
                    )
                    .context("context", "details")
                );
                assert_eq!(
                    EditoastError::from(Sources::Explicit {
                        error: std::io::Error::other("io failure"),
                        context: "details".to_owned(),
                    }),
                    EditoastError::new(
                        "editoast::Sources::Explicit",
                        500,
                        "explicit source: details",
                    )
                    .context("context", "details")
                );
                assert_eq!(
                    EditoastError::from(Sources::From(std::io::Error::other("io failure"))),
                    EditoastError::new("editoast::Sources::From", 500, "from: io failure")
                );
                assert_eq!(
                    EditoastError::from(Sources::Transparent(std::io::Error::other("io failure"))),
                    EditoastError::new("editoast::Sources::Transparent", 500, "io failure")
                );
            }

            #[test]
            fn derive_more_conversion_is_not_a_source() {
                #[derive(Debug, thiserror::Error, serde::Serialize, utoipa::ToSchema)]
                #[error("conversion error: {0}")]
                struct ConversionError(String);

                #[derive(Debug, thiserror::Error, ViewError, derive_more::From)]
                #[view_error(context)]
                enum Error {
                    #[error("derive_more: {0}")]
                    #[from(ConversionError)]
                    DeriveMore(ConversionError),
                }

                assert_eq!(
                    EditoastError::from(Error::DeriveMore(ConversionError("details".to_owned()))),
                    EditoastError::new(
                        "editoast::Error::DeriveMore",
                        500,
                        "derive_more: conversion error: details",
                    )
                    .context("0", "details")
                );
            }

            #[test]
            fn forwarded_view_errors() {
                #[derive(Debug, thiserror::Error, ViewError)]
                #[error("inner error: {detail}")]
                #[view_error(name = "inner", status = IM_A_TEAPOT, context)]
                struct InnerError {
                    detail: String,
                }

                #[derive(Debug, thiserror::Error, ViewError)]
                #[view_error(context)]
                enum Wrapper {
                    #[error(transparent)]
                    Transparent(#[view_error] InnerError),
                    #[error("{0}")]
                    From(
                        #[from]
                        #[view_error]
                        InnerError,
                    ),
                    #[error("{inner}")]
                    Source {
                        #[source]
                        #[view_error]
                        inner: InnerError,
                    },
                    #[error("{0}")]
                    Plain(#[view_error] InnerError),
                    #[error("{0}")]
                    Tuple(#[view_error] InnerError, String),
                    #[error("{inner}")]
                    Named {
                        #[view_error]
                        inner: InnerError,
                        ignored: String,
                    },
                    #[error("own error: {detail}")]
                    #[view_error(status = BAD_REQUEST)]
                    Own { detail: String },
                }

                assert_eq!(
                    EditoastError::from(Wrapper::Transparent(InnerError {
                        detail: "transparent".to_owned(),
                    })),
                    EditoastError::new("editoast::inner", 418, "inner error: transparent")
                        .context("detail", "transparent")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::From(InnerError {
                        detail: "from".to_owned(),
                    })),
                    EditoastError::new("editoast::inner", 418, "inner error: from")
                        .context("detail", "from")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::Source {
                        inner: InnerError {
                            detail: "source".to_owned(),
                        },
                    }),
                    EditoastError::new("editoast::inner", 418, "inner error: source")
                        .context("detail", "source")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::Plain(InnerError {
                        detail: "plain".to_owned(),
                    })),
                    EditoastError::new("editoast::inner", 418, "inner error: plain")
                        .context("detail", "plain")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::Tuple(
                        InnerError {
                            detail: "tuple".to_owned(),
                        },
                        "ignored".to_owned(),
                    )),
                    EditoastError::new("editoast::inner", 418, "inner error: tuple")
                        .context("detail", "tuple")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::Named {
                        inner: InnerError {
                            detail: "named".to_owned(),
                        },
                        ignored: "ignored".to_owned(),
                    }),
                    EditoastError::new("editoast::inner", 418, "inner error: named")
                        .context("detail", "named")
                );
                assert_eq!(
                    EditoastError::from(Wrapper::Own {
                        detail: "details".to_owned(),
                    }),
                    EditoastError::new("editoast::Wrapper::Own", 400, "own error: details",)
                        .context("detail", "details")
                );
            }
        }
    }
}
