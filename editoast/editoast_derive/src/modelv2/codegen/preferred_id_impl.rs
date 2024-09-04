use quote::quote;
use quote::ToTokens;

pub(crate) struct PreferredIdImpl {
    pub(super) model: syn::Ident,
    pub(super) ty: syn::Type,
}

impl ToTokens for PreferredIdImpl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, ty } = self;
        tokens.extend(quote! {
            #[automatically_derived]
            impl crate::modelsv2::PreferredId<#ty> for #model {}
        });
    }
}
