use std::collections::BTreeMap;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;
use utoipa::ToSchema;

#[derive(Default)]
pub struct LocalSchemas {
    pub schemas: BTreeMap<String, RefOr<Schema>>,
}

impl LocalSchemas {
    pub fn schema<'__s, S: ToSchema<'__s>>(mut self) -> Self {
        let (name, schema) = S::schema();
        self.schemas.insert(name.to_owned(), schema);
        self
    }

    pub fn include(mut self, other: Self) -> Self {
        self.schemas.extend(other.schemas);
        self
    }
}

impl IntoIterator for LocalSchemas {
    type Item = (String, RefOr<Schema>);
    type IntoIter = std::collections::btree_map::IntoIter<String, RefOr<Schema>>;

    fn into_iter(self) -> Self::IntoIter {
        self.schemas.into_iter()
    }
}

/// A macro that given a list of schemas, generates a function `fn schemas() -> LocalSchemas`
/// that returns the list of schemas
///
/// That way you don't have to import every schema in views/mod.rs to include them
/// in the top openapi annotation.
///
/// You can include schemas in another module my preceding them with `&`.
///
/// You can also use expressions that return a [LocalSchemas] object–such as
/// another `schema()` call, to forward it through the module hierarchy.
///
/// **YOU HAVE TO LEAVE A TRAILING COMMA AFTER THE LAST ITEM!!!**
///
/// # Example
///
/// ```
/// editoast_common::schemas! {
///     //MySchema,
///     //&nested::module::Schema,
///     //&Schema,
///     //sub_module::schemas(),
///     //AnotherSchema,
/// }
/// ```
#[macro_export]
macro_rules! schemas {
    (@build [$b:expr]) => { $b };

    (@build [$b:expr] $schema:ident , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.schema::<$schema>()] $($rest)*)
    };

    (@build [$b:expr] & $schema:path , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.schema::<$schema>()] $($rest)*)
    };

    (@build [$b:expr] $sub:expr , $($rest:tt)*) => {
        $crate::schemas!(@build [$b.include($sub)] $($rest)*)
    };

    (@build [$b:expr] $($tt:tt)*) => { compile_error!(stringify!("schemas!: invalid specifier: " $($tt)*)) };

    ($($tt:tt)*) => {
        pub fn schemas() -> $crate::schemas::LocalSchemas {
            $crate::schemas!(@build [$crate::schemas::LocalSchemas::default()] $($tt)*)
        }
    };
}
