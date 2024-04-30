use crate::modelv2::ModelField;
use quote::quote;
use quote::ToTokens;
use syn::parse_quote;

pub(crate) struct ModelFieldApiImplBlock {
    pub(super) model: syn::Ident,
    pub(super) field: ModelField,
}

impl ToTokens for ModelFieldApiImplBlock {
    fn to_tokens(&self, tokens: &mut proc_macro2::TokenStream) {
        let Self { model, field } = self;
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
            impl crate::modelsv2::prelude::ModelField<#model, #ty, #column> {
                pub fn eq(&self, value: #ty) -> crate::modelsv2::prelude::FilterSetting<#model> {
                    use diesel::ExpressionMethods;
                    #transform;
                    crate::modelsv2::prelude::FilterSetting::new(#column.eq(value))
                }

                pub fn eq_any(&self, values: Vec<#ty>) -> crate::modelsv2::prelude::FilterSetting<#model> {
                    use diesel::ExpressionMethods;
                    #map_transform;
                    crate::modelsv2::prelude::FilterSetting::new(#column.eq_any(values))
                }

                pub fn asc(&self) -> crate::modelsv2::prelude::SortSetting<#model> {
                    use diesel::ExpressionMethods;
                    crate::modelsv2::prelude::SortSetting(Box::new(#column.asc()))
                }

                pub fn desc(&self) -> crate::modelsv2::prelude::SortSetting<#model> {
                    use diesel::ExpressionMethods;
                    crate::modelsv2::prelude::SortSetting(Box::new(#column.desc()))
                }
            }
        });
    }
}
