use super::typing::TypeSpec;

pub(super) struct Criteria {
    pub(super) name: String,
    pub(super) data_type: TypeSpec,
}

pub(super) struct Property {
    pub(super) name: String,
    pub(super) sql: String,
    #[allow(unused)]
    pub(super) data_type: Option<TypeSpec>,
}

pub struct SearchConfig {
    #[allow(unused)]
    pub(super) name: String,
    pub(super) table: String,
    pub(super) criterias: Vec<Criteria>,
    pub(super) properties: Vec<Property>,
    pub(super) joins: Option<String>,
}

pub trait SearchObject {
    fn search_config() -> SearchConfig;
}

pub trait SearchConfigStore {
    /// Returns the search object configuration for the given object name
    ///
    /// See derive macro `SearchConfigStore` for more information.
    fn find<S: AsRef<str>>(object_name: S) -> Option<SearchConfig>;
}
