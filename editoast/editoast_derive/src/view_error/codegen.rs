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
    pub(super) status_impl: Vec<(syn::Pat, args::StatusCodeArg)>,
    pub(super) variant_label_impl: Option<Vec<(syn::Pat, String)>>,
    pub(super) context_impl: Vec<(syn::Pat, Context)>,
    pub(super) responses_impl: Vec<OpenApiResponse>,
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
    pub(super) sub_label: Option<String>,
    pub(super) status: args::StatusCodeArg,
    pub(super) message_template: Option<String>,
    pub(super) context: Vec<ContextEntrySpec>,
}

pub(super) struct ContextEntrySpec {
    pub(super) key: String,
    pub(super) ty: syn::Type,
}

impl ToTokens for ViewErrorImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            implementor,
            label,
            status_impl,
            variant_label_impl,
            context_impl,
            responses_impl,
        } = self;

        let (status_pat, status_code): (Vec<_>, Vec<_>) = status_impl.iter().cloned().unzip();
        let (context_pat, context_entry): (Vec<_>, Vec<_>) = context_impl.iter().cloned().unzip();
        let variant_label_impl = variant_label_impl
            .as_ref()
            .map(|vl_impl| {
                let (pat, label): (Vec<_>, Vec<_>) = vl_impl.iter().cloned().unzip();
                quote::quote! {
                    match self {
                        #(#pat => Some(#label)),*
                    }
                }
            })
            .unwrap_or(quote::quote! { None });

        tokens.extend(quote::quote! {
            impl crate::views::error::ViewError for #implementor {
                const LABEL: &'static str = #label;

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
                    Vec::from([#(#responses_impl),*])
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
                label: #sub_label,
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

impl ToTokens for args::StatusCodeArg {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let code = &self.0;
        tokens.extend(quote::quote! { axum::http::StatusCode::#code })
    }
}
