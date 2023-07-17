//! Provides [OpenApiMerger] that can be used to merge our old manually written
//! OpenAPI with the new generated one incrementally in order to avoid protential
//! breaking changes.
//!
//! This module is meant to be deleted at the end of the OpenAPI replacement
//! process.

use std::path::Path;

use serde_json::Value as Json;

pub(super) struct OpenApiMerger {
    old: Json,
    new: Json,
}

/// Returns the parent object of the JSON at path and the key to access the child, if they exist
fn find_parent_of<'a>(
    path: &'a Path,
    json: &'a mut Json,
) -> Option<(&'a mut Json, Option<String>)> {
    find_json_at(path.parent().expect("path should have a parent"), json).map(|(parent, _)| {
        let key =
            find_path_in_object(Path::new(path.file_name().unwrap()), parent).map(|(key, _)| key);
        (parent, key)
    })
}

/// Searches the json object for the given path, returning its original key and
/// the extra path components, if they exist
fn find_path_in_object<'a>(path: &'a Path, json: &Json) -> Option<(String, &'a Path)> {
    for key in json.as_object().unwrap().keys() {
        let mut key_path = Path::new(key);
        key_path = key_path.strip_prefix("/").unwrap_or(key_path);
        if path.starts_with(key_path) {
            let relative_path = path.strip_prefix(key_path).unwrap();
            return Some((key.clone(), relative_path));
        }
    }
    None
}

/// Returns the JSON value at path and its key in its parent, if they exist
fn find_json_at<'a>(mut path: &'a Path, json: &'a mut Json) -> Option<(&'a mut Json, String)> {
    path = path.strip_prefix("/").unwrap_or(path);
    if path == Path::new("") {
        return Some((json, String::new()));
    }
    let object = json.as_object_mut().expect("json in path is not an object");
    for (key, json) in object.iter_mut() {
        let mut key_path = Path::new(key);
        key_path = key_path.strip_prefix("/").unwrap_or(key_path);
        if path.starts_with(key_path) {
            let relative_path = path.strip_prefix(key_path).unwrap();
            match find_json_at(relative_path, json) {
                Some((json, last_key)) if last_key.is_empty() => return Some((json, key.clone())),
                None => continue,
                ret => return ret,
            }
        }
    }
    None
}

/// Tries to find the JSON value at path. If the full path doesn't exist in the document,
/// the function returns the deepest existing object alongwith the remaining non-existent path
fn try_find_json_at<'a>(mut path: &'a Path, json: &'a mut Json) -> (&'a mut Json, &'a Path) {
    path = path.strip_prefix("/").unwrap_or(path);
    if path == Path::new("") {
        return (json, path);
    }
    if !json.is_object() {
        return (json, path);
    };
    let ro_json = json.to_owned();
    if let Some((key, relative_path)) = find_path_in_object(path, &ro_json) {
        try_find_json_at(
            relative_path,
            json.as_object_mut().unwrap().get_mut(&key).unwrap(),
        )
    } else {
        (json, path)
    }
}

impl OpenApiMerger {
    pub fn new(old_content: String, new_content: String) -> Self {
        Self {
            old: serde_yaml::from_str(&old_content)
                .expect("the old OpenAPI should be a valid YAML or JSON doc"),
            new: serde_yaml::from_str(&new_content)
                .expect("the new OpenAPI should be a valid YAML or JSON doc"),
        }
    }

    /// Deletes a subtree from the old json openapi
    #[must_use]
    #[allow(unused)]
    pub fn reject_old(mut self, path: &str) -> Self {
        let path = Path::new(path);
        let key = path
            .file_name()
            .expect("the path to reject should exist in the old OpenApi")
            .to_str()
            .unwrap()
            .to_owned();
        if let (json, Some(key)) =
            find_parent_of(path, &mut self.old).expect("reject_old: could not find object at path")
        {
            json.as_object_mut().unwrap().remove(&key);
        }
        self
    }

    /// Takes the subtree at `new_src_path` in the new openapi alongwith its
    /// key and inserts it into the object of the old openapi at `old_parent_path`
    ///
    /// ```
    /// let old = json!({"paths": {"/A": null, "/B": {"C/": null}}});
    /// let new = json!({"paths": {"/A": 12, "/B": null, "/B/C": null}});
    /// assert_eq!(
    ///     OpenApiMerger::new(old.to_string(), new.to_string())
    ///         .take_new("paths/A", "paths")
    ///         .take_new("paths/B/C", "paths")
    ///         .finish();
    ///     json!({"paths": {"/A": 12, "/B": {"C/": null}, "B/C/": null}})
    /// );
    /// ```
    #[must_use]
    #[allow(unused)]
    pub fn take_new(mut self, new_src_path: &str, old_parent_path: &str) -> Self {
        let src = Path::new(new_src_path);
        let (new_object, new_key) =
            find_json_at(src, &mut self.new).expect("take_new: src object must exist");
        let dst = Path::new(old_parent_path);
        let dst_object = find_json_at(dst, &mut self.old)
            .expect("take_new: old_parent_path must exist")
            .0;
        let dst_map = dst_object
            .as_object_mut()
            .expect("take_new: old_parent_path must be an object");
        if let Some((_, old_key)) =
            find_json_at(Path::new(&new_key), &mut Json::Object(dst_map.to_owned()))
        {
            dst_map.remove(&old_key);
        }
        dst_map.insert(new_key, new_object.clone());
        self
    }

    /// Takes the subtree at `new_src_path` in the new openapi and puts it at
    /// the key `old_parent_path` in the old openapi
    ///
    /// ```
    /// let old = json!({"paths": {"/A": null, "/B": {"C/": null}}});
    /// let new = json!({"paths": {"/A": 12, "/B": null, "/B/C": 42}});
    /// assert_eq!(
    ///     OpenApiMerger::new(old.to_string(), new.to_string())
    ///         .put_at("paths/A", "paths/A")
    ///         .put_at("paths/B/C", "paths/B/C")
    ///         .finish();
    ///     json!({"paths": {"/A": 12, "/B": {"C/": 42}}})
    /// );
    /// ```
    ///
    /// See [OpenApiMerger::replace]
    #[must_use]
    #[allow(unused)]
    pub fn put_at(mut self, new_src_path: &str, old_dst_path: &str) -> Self {
        let src = Path::new(new_src_path);
        let (new_object, _) =
            find_json_at(src, &mut self.new).expect("put_at: src object must exist");
        let dst = Path::new(old_dst_path);
        let (parent_object, old_key) =
            find_parent_of(dst, &mut self.old).expect("put_at: old_dst_path parent must exist");
        parent_object
            .as_object_mut()
            .expect("put_at: old_dst_path parent must be an object")
            .insert(
                old_key.unwrap_or_else(|| {
                    dst.file_name()
                        .expect("put_at: dst path should end with a key name")
                        .to_str()
                        .unwrap()
                        .to_owned()
                }),
                new_object.clone(),
            );
        self
    }

    /// Just like [Self::put_at] for when the src and the dst are identical
    #[must_use]
    #[allow(unused)]
    pub fn replace(self, path: &str) -> Self {
        self.put_at(path, path)
    }

    #[must_use]
    #[allow(unused)]
    /// Ensures that the full path exists by creating the hierarchy if not
    ///
    /// Does not overwrite existing values.
    pub fn create_path(mut self, path: &str) -> Self {
        let dst = Path::new(path);
        match try_find_json_at(dst, &mut self.old) {
            (_, path) if path == Path::new("") => {
                return self;
            }
            (json, path) => {
                let mut json = json;
                for key in path {
                    let key = key.to_str().unwrap();
                    let object = json.as_object_mut().unwrap();
                    object.insert(key.to_owned(), Json::Object(Default::default()));
                    json = object.get_mut(&key.to_owned()).unwrap();
                }
            }
        }
        self
    }

    /// Returns the merged OpenAPI
    pub fn finish(self) -> Json {
        self.old
    }
}

#[cfg(test)]
mod test {
    use pretty_assertions::assert_eq;
    use rstest::{fixture, rstest};
    use serde_json::{json, Value};

    use super::OpenApiMerger;

    #[fixture]
    fn old() -> Value {
        json!({
            "A": "old_A",
            "B": "old_B",
            "C": "old_C"
        })
    }

    #[fixture]
    fn new() -> Value {
        json!({
            "A": "new_A",
            "B": "new_B",
            "C": "new_C",
            "D": "new_D"
        })
    }

    #[rstest]
    fn test_simple_update(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("B")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "new_B",
                "C": "old_C"
            })
        )
    }

    #[rstest]
    fn test_simple_reject(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .reject_old("B")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "C": "old_C"
            })
        )
    }

    #[rstest]
    fn test_simple_new(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("D")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "old_B",
                "C": "old_C",
                "D": "new_D"
            })
        )
    }

    #[rstest]
    fn test_simple_take_new(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .take_new("B", "") // replacement
            .take_new("D", "") // insertion
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "new_B",
                "C": "old_C",
                "D": "new_D",
            })
        )
    }

    #[rstest]
    fn test_simple_put_at_existing_location(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .put_at("B", "A")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_B",
                "B": "old_B",
                "C": "old_C",
            })
        )
    }

    #[rstest]
    fn test_simple_put_at_new_location(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .put_at("D", "E")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "old_A",
                "B": "old_B",
                "C": "old_C",
                "E": "new_D"
            })
        )
    }

    #[rstest::rstest]
    async fn test_create_path() {
        assert_eq!(
            OpenApiMerger::new(
                json!({
                    "X": {
                        "Y": 42
                    }
                })
                .to_string(),
                "".to_owned()
            )
            .create_path("A")
            .create_path("nested/b/c/d")
            .create_path("X/Y") // no replacement
            .create_path("X/Z")
            .finish(),
            json!({
                "A": {},
                "nested": {
                    "b": {
                        "c": {
                            "d": {}
                        }
                    }
                },
                "X": {
                    "Y": 42,
                    "Z": {}
                }
            })
        );
    }

    #[rstest]
    fn test_simple_all(old: Value, new: Value) {
        let merged = OpenApiMerger::new(old.to_string(), new.to_string())
            .replace("B")
            .reject_old("C")
            .put_at("D", "E")
            .put_at("A", "F")
            .take_new("A", "")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_A",
                "B": "new_B",
                "E": "new_D",
                "F": "new_A"
            })
        )
    }

    #[fixture]
    fn old_nested() -> Value {
        json!({
            "A": {
                "A1": "old_A1",
                "A2": "old_A2",
                "A3": "old_A3"
            },
            "B": {
                "B1": "old_B1",
                "B2": "old_B2",
                "B3": "old_B3"
            },
            "C": {
                "C1": "old_C1",
                "C2": "old_C2",
                "C3": "old_C3"
            }
        })
    }

    #[fixture]
    fn new_nested() -> Value {
        json!({
            "A": {
                "A1": "new_A1",
                "A2": "new_A2",
                "A3": "new_A3",
                "A4": "new_A4"
            },
            "B": {
                "B1": "new_B1",
                "B2": "new_B2",
                "B3": "new_B3",
                "B4": "new_B4"
            },
            "C": {
                "C1": "new_C1",
                "C2": "new_C2",
                "C3": "new_C3",
                "C4": "new_C4"
            },
            "D": {
                "D1": "new_D1",
                "D2": "new_D2",
                "D3": "new_D3"
            },
            "E": {
                "E1": "new_E1",
                "E2": "new_E2",
                "E3": "new_E3"
            }
        })
    }

    #[rstest]
    fn test_nested_reject(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .reject_old("B/B2")
            .reject_old("C")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3"
                },
                "B": {
                    "B1": "old_B1",
                    "B3": "old_B3"
                }
            })
        )
    }

    #[rstest]
    fn test_nested_new(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .replace("D") // existing dst
            .create_path("E")
            .replace("E/E1") // new dst
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3"
                },
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3"
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3"
                },
                "D": {
                    "D1": "new_D1",
                    "D2": "new_D2",
                    "D3": "new_D3"
                },
                "E": {
                    "E1": "new_E1"
                }
            })
        )
    }

    #[rstest]
    fn test_nested_put_at(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .put_at("B/B2", "A")
            .put_at("D", "C/C4")
            .create_path("C/C4/E1")
            .put_at("E/E1", "C/C4/E1/nested")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": "new_B2",
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3"
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3",
                    "C4": {
                        "D1": "new_D1",
                        "D2": "new_D2",
                        "D3": "new_D3",
                        "E1": {
                            "nested": "new_E1"
                        }
                    }
                }
            })
        )
    }

    #[rstest]
    fn test_nested_take_new(old_nested: Value, new_nested: Value) {
        let merged = OpenApiMerger::new(old_nested.to_string(), new_nested.to_string())
            .take_new("B/B2", "A")
            .take_new("D", "C")
            .create_path("B/B4/nested")
            .take_new("E/E1", "B/B4/nested")
            .finish();
        assert_eq!(
            merged,
            json!({
                "A": {
                    "A1": "old_A1",
                    "A2": "old_A2",
                    "A3": "old_A3",
                    "B2": "new_B2"
                },
                "B": {
                    "B1": "old_B1",
                    "B2": "old_B2",
                    "B3": "old_B3",
                    "B4": {
                        "nested": {
                            "E1": "new_E1"
                        }
                    }
                },
                "C": {
                    "C1": "old_C1",
                    "C2": "old_C2",
                    "C3": "old_C3",
                    "D": {
                        "D1": "new_D1",
                        "D2": "new_D2",
                        "D3": "new_D3"
                    }
                }
            })
        )
    }

    #[rstest]
    async fn test_insaaaaane() {
        let hard_old = json!({
            "paths": {
                "/documents/": {
                    "post": "post"
                },
                "/documents/{key}/": {
                    "delete": "delete",
                    "get": "get"
                },
                "/electrical_profile_set/": {
                    "/": {
                        "get": "get",
                        "post": "post"
                    },
                    "/{id}/": {
                        "get": "get"
                    }
                }
            }
        });
        let hard_new = json!({
            "paths": {
                "/documents": {
                    "post": "post",
                    "patch": "patch"
                },
                "/documents/{key}/new": {
                    "get": "get",
                },
                "/documents/{key}/bye": {
                    "delete": "delete",
                },
                "/electrical_profile_set": {
                    "get": "get",
                    "post": "post",
                    "put": "put"
                },
                "/electrical_profile_set/{id}": {
                    "get": "get",
                    "delete": "delete",
                    "head": "head"
                }
            }
        });
        let merged = OpenApiMerger::new(hard_old.to_string(), hard_new.to_string())
            .replace("paths/documents/")
            .take_new("paths/documents/{key}/new", "paths")
            .take_new("paths/documents/{key}/bye", "paths")
            .take_new("paths/electrical_profile_set/", "paths") // takes the new one that replaces the old one with the trailing slash
            .finish();
        assert_eq!(
            merged,
            json!({
                "paths": {
                    "/documents/": {
                        "post": "post",
                        "patch": "patch"
                    },
                    "/documents/{key}/": {
                        "delete": "delete",
                        "get": "get"
                    },
                    "/electrical_profile_set": {
                        "get": "get",
                        "post": "post",
                        "put": "put"
                    },
                    "/documents/{key}/new": {
                        "get": "get",
                    },
                    "/documents/{key}/bye": {
                        "delete": "delete",
                    }
                }
            })
        );
    }
}
