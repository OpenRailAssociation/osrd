use darling::Result;
use proc_macro2::TokenStream;
use quote::quote;
use syn::DeriveInput;
use syn::LitStr;
use syn::parse_quote;

const OPTIONAL_SUFFIX: &str = "::option";
struct UnitType {
    unit: String,
    optional: bool,
}

impl UnitType {
    fn new(path: LitStr) -> Self {
        let path = path.value();
        let optional = path.ends_with(OPTIONAL_SUFFIX);
        let unit = path
            .strip_suffix(OPTIONAL_SUFFIX)
            .unwrap_or(&path)
            .rsplit("::")
            .next()
            .expect("String::split to return at least an empty string")
            .to_owned();
        Self { unit, optional }
    }
}

fn get_abbreviation(value: &str) -> Option<&'static str> {
    // Any new value here must also be added in common/src/units.rs
    match value {
        "second" => Some("Duration in s"),
        "millisecond" => Some("Duration in ms"),
        "meter" => Some("Length in m"),
        "millimeter" => Some("Length in mm"),
        "meter_per_second" => Some("Velocity in m·s⁻¹"),
        "meter_per_second_squared" => Some("Acceleration in m·s⁻²"),
        "kilogram" => Some("Mass in kg"),
        "newton" => Some("Solid Friction in N"),
        "hertz" => Some("Viscosity friction per weight in s⁻¹"),
        "kilogram_per_meter" => Some("Aerodynamic drag in kg·m⁻¹"),
        "kilogram_per_second" => Some("Viscosity friction in kg·s⁻¹"),
        "per_meter" => Some("Aerodynamic drag per kg in m⁻¹"),
        _ => None,
    }
}

pub fn annotate_units(input: &mut DeriveInput) -> Result<TokenStream> {
    // We look for fields that have #[sered(with="meter")] attributes
    // and we push two new attributes to it to improve the OpenAPI
    if let syn::Data::Struct(s) = &mut input.data {
        for f in s.fields.iter_mut() {
            for attr in f.attrs.clone() {
                if attr.path().is_ident("serde") {
                    let _ = attr.parse_nested_meta(|meta| {
                        if meta.path.is_ident("with") {
                            let value = meta.value()?;
                            let s: LitStr = value.parse()?;
                            let unit = UnitType::new(s);
                            if let Some(abbreviation) = get_abbreviation(&unit.unit) {
                                if unit.optional {
                                    f.attrs
                                        .push(parse_quote! {#[schema(value_type = Option<f64>)]});
                                } else {
                                    f.attrs.push(parse_quote! {#[schema(value_type = f64)]});
                                }
                                f.attrs.push(parse_quote! {#[doc = #abbreviation]});
                            }
                        }
                        Ok(())
                    });
                }
            }
        }
    }
    Ok(quote! {#input})
}
