use crate::model::ModelField;
use quote::ToTokens;
use quote::quote;
use syn::parse_quote;

pub(crate) struct ModelFieldApiImplBlock {
    pub(super) model: syn::Ident,
    pub(super) field: ModelField,
    pub(super) field_wrapper: syn::Ident,
}

impl ToTokens for ModelFieldApiImplBlock {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self {
            model,
            field,
            field_wrapper,
        } = self;
        let ModelField { ty, column, .. } = &field;
        let (transform, map_transform) = if field.has_transformation() {
            let transform_ty = field.transform_type();
            let into_transformed = field.into_transformed(parse_quote! { value });
            let transform = quote! { let value: #transform_ty = #into_transformed };
            let map_transform = quote! { let values: Vec<#transform_ty> = values.into_iter().map(|value| #into_transformed).collect() };
            (transform, map_transform)
        } else {
            (quote! {}, quote! {})
        };
        tokens.extend(quote! {
            impl #field_wrapper<#model, #ty, #column> {
                pub fn eq(&self, value: #ty) -> crate::prelude::FilterSetting<#model> {
                    use diesel::ExpressionMethods;
                    #transform;
                    crate::prelude::FilterSetting::new(#column.eq(value))
                }

                pub fn eq_any(&self, values: Vec<#ty>) -> crate::prelude::FilterSetting<#model> {
                    use diesel::ExpressionMethods;
                    #map_transform;
                    crate::prelude::FilterSetting::new(#column.eq_any(values))
                }

                pub fn asc(&self) -> crate::prelude::SortSetting<#model> {
                    use diesel::ExpressionMethods;
                    crate::prelude::SortSetting(Box::new(#column.asc()))
                }

                pub fn desc(&self) -> crate::prelude::SortSetting<#model> {
                    use diesel::ExpressionMethods;
                    crate::prelude::SortSetting(Box::new(#column.desc()))
                }
            }
        });
    }
}
