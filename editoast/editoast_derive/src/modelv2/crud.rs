use darling::FromMeta;
use syn::Expr;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub(super) struct Crud {
    pub(super) create: bool,
    pub(super) read: bool,
    pub(super) update: bool,
    pub(super) delete: bool,
}

impl FromMeta for Crud {
    fn from_expr(expr: &syn::Expr) -> darling::Result<Self> {
        match expr {
            Expr::Path(path) => {
                let s = path
                    .path
                    .segments
                    .first()
                    .expect("a valid path has at least one segment")
                    .ident
                    .to_string()
                    .to_lowercase();
                if let Some(find) = s.chars().find(|c| !"crud".contains(*c)) {
                    return Err(darling::Error::unknown_value(&find.to_string()).with_span(path));
                }
                Ok(Self {
                    create: s.contains('c'),
                    read: s.contains('r'),
                    update: s.contains('u'),
                    delete: s.contains('d'),
                })
            }
            _ => Err(darling::Error::unexpected_expr_type(expr)),
        }
        .map_err(|e| e.with_span(expr))
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use quote::quote;

    use super::*;

    fn parse(tokens: proc_macro2::TokenStream) -> Option<Crud> {
        let sym: syn::Attribute = syn::parse_quote!(#[ignore = #tokens]);
        FromMeta::from_meta(&sym.meta).ok()
    }

    #[test]
    fn full() {
        assert_eq!(
            parse(quote! { crud }).unwrap(),
            Crud {
                create: true,
                read: true,
                update: true,
                delete: true,
            }
        );
    }

    #[test]
    fn some() {
        assert_eq!(
            parse(quote! { rd }).unwrap(),
            Crud {
                create: false,
                read: true,
                update: false,
                delete: true,
            }
        );
    }

    #[test]
    fn one() {
        assert_eq!(
            parse(quote! { c }).unwrap(),
            Crud {
                create: true,
                read: false,
                update: false,
                delete: false,
            }
        );
        assert_eq!(
            parse(quote! { r }).unwrap(),
            Crud {
                create: false,
                read: true,
                update: false,
                delete: false,
            }
        );
    }

    #[test]
    fn duplicates() {
        assert_eq!(
            parse(quote! { ccrd }).unwrap(),
            Crud {
                create: true,
                read: true,
                update: false,
                delete: true,
            }
        );
    }

    #[test]
    fn invalid() {
        assert!(parse(quote! { crod }).is_none());
    }
}
