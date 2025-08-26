use quote::ToTokens;
use quote::quote;

pub(crate) struct FieldWrapperDecl {
    pub(super) vis: syn::Visibility,
    pub(super) ident: syn::Ident,
}

impl ToTokens for FieldWrapperDecl {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { vis, ident } = self;
        tokens.extend(quote! {
            #[doc(hidden)]
            #vis struct #ident<M, T, Column>(core::marker::PhantomData<(M, T, Column)>);
        });
    }
}
