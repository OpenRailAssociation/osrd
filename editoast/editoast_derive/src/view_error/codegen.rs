use quote::ToTokens;

use crate::view_error::args;

pub(super) struct Codegen(pub(super) ViewErrorImpl);

impl ToTokens for Codegen {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self(view_error_impl) = self;
        let ty = &view_error_impl.implementor;
        tokens.extend(quote::quote! {
            #view_error_impl

            impl utoipa::IntoResponses for #ty {
                fn responses() -> std::collections::BTreeMap<
                    String,
                    utoipa::openapi::RefOr<utoipa::openapi::response::Response>,
                > {
                    <Self as crate::views::error::ViewError>::utoipa_responses().into()
                }
            }

            impl axum::response::IntoResponse for #ty {
                fn into_response(self) -> axum::response::Response {
                    <Self as crate::views::error::ViewError>::into_response(self)
                }
            }
        });
    }
}

pub(super) struct ViewErrorImpl {
    pub(super) implementor: syn::Ident,
    pub(super) label: String,
    pub(super) label_impl: Vec<(syn::Pat, OrForwarded<String>)>,
    pub(super) status_impl: Vec<(syn::Pat, OrForwarded<args::StatusCodeArg>)>,
    pub(super) variant_label_impl: Option<Vec<(syn::Pat, OrForwarded<String>)>>,
    pub(super) context_impl: Vec<(syn::Pat, OrForwarded<Context>)>,
    pub(super) responses_impl: ResponsesImpl,
}

pub(super) struct ResponsesImpl {
    pub(super) openapi: Vec<OpenApiResponse>,
    pub(super) forwarded_view_errors: Vec<syn::Type>,
}

/// ViewErrors can be forwarded when included in another error type using
/// `#[view_error]`. In that case the forwarded error is used and all information
/// about the wrapping type or variant is ignored. This enum allows to either provide
/// a value to emit on the token stream or forward a `trait ViewError` function call result
/// to implement forwarding.
#[derive(Clone)]
pub(super) enum OrForwarded<T: ToTokens> {
    Value(T),
    Forwarded { binding: syn::Ident },
}

#[derive(Clone)]
pub(super) struct Context {
    pub(super) entries: Vec<ContextEntry>,
}

#[derive(Clone)]
pub(super) struct ContextEntry {
    pub(super) key: String,
    pub(super) binding: syn::Ident,
}

pub(super) struct OpenApiResponse {
    pub(super) label: String,
    pub(super) sub_label: Option<String>,
    pub(super) status: args::StatusCodeArg,
    pub(super) message_template: Option<String>,
    pub(super) context: Vec<ContextEntrySpec>,
}

pub(super) struct ContextEntrySpec {
    pub(super) key: String,
    pub(super) ty: syn::Type,
}

impl ViewErrorImpl {
    pub(super) fn new(implementor: syn::Ident, label: String) -> Self {
        Self {
            implementor,
            label,
            label_impl: Vec::new(),
            status_impl: Vec::new(),
            variant_label_impl: None,
            context_impl: Vec::new(),
            responses_impl: ResponsesImpl {
                openapi: Vec::new(),
                forwarded_view_errors: Vec::new(),
            },
        }
    }

    pub(super) fn push_error(&mut self, pat: syn::Pat, context: Context, openapi: OpenApiResponse) {
        self.label_impl
            .push((pat.clone(), OrForwarded::Value(self.label.clone())));
        self.status_impl
            .push((pat.clone(), OrForwarded::Value(openapi.status.clone())));
        if let Some(sub_label) = openapi.sub_label.clone() {
            self.variant_label_impl
                .get_or_insert_default()
                .push((pat.clone(), OrForwarded::Value(sub_label)));
        }
        self.context_impl.push((pat, OrForwarded::Value(context)));
        self.responses_impl.openapi.push(openapi);
    }

    pub(super) fn forward_view_error(
        &mut self,
        pat: syn::Pat,
        binding: syn::Ident,
        fwd_ty: syn::Type,
    ) {
        self.label_impl.push((
            pat.clone(),
            OrForwarded::Forwarded {
                binding: binding.clone(),
            },
        ));
        self.status_impl.push((
            pat.clone(),
            OrForwarded::Forwarded {
                binding: binding.clone(),
            },
        ));
        self.variant_label_impl.get_or_insert_default().push((
            pat.clone(),
            OrForwarded::Forwarded {
                binding: binding.clone(),
            },
        ));
        self.context_impl
            .push((pat, OrForwarded::Forwarded { binding }));
        self.responses_impl.forwarded_view_errors.push(fwd_ty);
    }
}

impl ToTokens for ViewErrorImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            implementor,
            label: _,
            label_impl,
            status_impl,
            variant_label_impl,
            context_impl,
            responses_impl:
                ResponsesImpl {
                    openapi,
                    forwarded_view_errors,
                },
        } = self;

        let (status_pat, status_code): (Vec<_>, Vec<_>) = status_impl.iter().cloned().unzip();
        let status_code = OrForwarded::apply(status_code, &syn::parse_quote! { status });

        let (label_pat, label_value): (Vec<_>, Vec<_>) = label_impl.iter().cloned().unzip();
        let label_value = OrForwarded::apply(label_value, &syn::parse_quote! { label });

        let (context_pat, context_entry): (Vec<_>, Vec<_>) = context_impl.iter().cloned().unzip();
        let context_entry = OrForwarded::apply(context_entry, &syn::parse_quote! { context });

        let sub_label = syn::parse_quote! { sub_label };
        let variant_label_impl = variant_label_impl
            .as_ref()
            .map(|variant_label_impl| {
                let arms = variant_label_impl.iter().map(|(pattern, value)| {
                    let value = match value {
                        OrForwarded::Value(value) => quote::quote! { Some(#value) },
                        OrForwarded::Forwarded { binding: _ } => value.as_tokens(&sub_label),
                    };
                    quote::quote! { #pattern => #value }
                });
                quote::quote! {
                    match self {
                        #(#arms),*
                    }
                }
            })
            .unwrap_or_else(|| quote::quote! { None });

        let maybe_mut = (!forwarded_view_errors.is_empty()).then_some(quote::quote! { mut });
        tokens.extend(quote::quote! {
            impl crate::views::error::ViewError for #implementor {
                fn label(&self) -> &'static str {
                    match self {
                        #(#label_pat => #label_value),*
                    }
                }

                fn status(&self) -> axum::http::StatusCode {
                    match self {
                        #(#status_pat => #status_code),*
                    }
                }

                fn sub_label(&self) -> Option<&'static str> {
                    #variant_label_impl
                }

                fn context(self) -> std::collections::HashMap<String, serde_json::Value> {
                    match self {
                        #(#context_pat => #context_entry),*
                    }
                }

                fn responses() -> Vec<crate::views::error::OpenApiResponse> {
                    let #maybe_mut responses = Vec::from([#(#openapi),*]);
                    #(
                        responses.extend(
                            <#forwarded_view_errors as crate::views::error::ViewError>::responses()
                        );
                    )*
                    responses
                }
            }
        });
    }
}

impl ToTokens for Context {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { entries } = self;
        tokens.extend(quote::quote! {
            std::collections::HashMap::from([
                #(#entries),*
            ])
        });
    }
}

impl ToTokens for ContextEntry {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { key, binding } = self;
        let serialization_error = format!("failed to serialize context entry {key}");
        tokens.extend(quote::quote! {
            (#key.to_owned(), serde_json::to_value(#binding).expect(#serialization_error))
        });
    }
}

impl ToTokens for OpenApiResponse {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            label,
            sub_label,
            message_template,
            status,
            context,
        } = self;
        let sub_label = sub_label
            .as_ref()
            .map(|label| quote::quote! { Some(#label) })
            .unwrap_or_else(|| quote::quote! { None });
        let message_template = message_template
            .as_ref()
            .map(|message| quote::quote! { Some(#message) })
            .unwrap_or_else(|| quote::quote! { None });
        tokens.extend(quote::quote! {
            crate::views::error::OpenApiResponse {
                label: #label,
                sub_label: #sub_label,
                message_template: #message_template,
                status: #status,
                context: Vec::from([#(#context),*]),
            }
        });
    }
}

impl ToTokens for ContextEntrySpec {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { key, ty } = self;
        tokens.extend(quote::quote! {
            crate::views::error::ContextEntry {
                key: #key,
                schema: <#ty as utoipa::PartialSchema>::schema(),
            }
        });
    }
}

impl<T: ToTokens> OrForwarded<T> {
    fn as_tokens(&self, method: &syn::Ident) -> proc_macro2::TokenStream {
        match self {
            OrForwarded::Value(value) => quote::quote! { #value },
            OrForwarded::Forwarded { binding } => {
                quote::quote! { crate::views::error::ViewError::#method(#binding) }
            }
        }
    }

    fn apply(
        it: impl IntoIterator<Item = Self>,
        method: &syn::Ident,
    ) -> Vec<proc_macro2::TokenStream> {
        it.into_iter().map(|item| item.as_tokens(method)).collect()
    }
}

impl ToTokens for args::StatusCodeArg {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let code = &self.0;
        tokens.extend(quote::quote! { axum::http::StatusCode::#code })
    }
}
