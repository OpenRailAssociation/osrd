use std::marker::PhantomData;

use rocket::{
    form::{self, FromFormField, ValueField},
    request::FromParam,
};
use strum::IntoEnumIterator;

use crate::schema::ObjectType;

/// This parameter is used to deserialized a list of `T`
#[derive(Debug)]
pub struct List<'f, T: FromFormField<'f> + Send + Sync>(pub Vec<T>, PhantomData<&'f T>);

impl<'f, T: FromFormField<'f> + Send + Sync> List<'f, T> {
    fn new(v: Vec<T>) -> Self {
        Self(v, PhantomData)
    }
}

impl<'f, T: FromFormField<'f> + Send + Sync> Default for List<'f, T> {
    fn default() -> Self {
        Self::new(Default::default())
    }
}

impl<'f, T: FromFormField<'f> + Send + Sync> FromFormField<'f> for List<'f, T> {
    fn from_value(field: ValueField<'f>) -> form::Result<'f, Self> {
        let field = field.value;
        let mut res = vec![];
        if !field.is_empty() {
            for element in field.split(',') {
                let element = T::from_value(ValueField::from_value(element))?;
                res.push(element);
            }
        }
        Ok(List::new(res))
    }

    fn default() -> Option<Self> {
        Some(Default::default())
    }
}

impl<'a> FromParam<'a> for ObjectType {
    type Error = &'a str;

    fn from_param(param: &'a str) -> Result<Self, Self::Error> {
        for obj_type in ObjectType::iter() {
            let type_str = serde_json::to_string(&obj_type).unwrap();
            let type_str = type_str.trim_matches('"');
            if type_str == param {
                return Ok(obj_type);
            }
        }
        Err(param)
    }
}

#[cfg(test)]
mod tests {
    use crate::schema::ObjectType;
    use rocket::request::FromParam;

    #[test]
    fn obj_type_from_param() {
        let res = ObjectType::from_param("TrackSection").unwrap();
        assert_eq!(res, ObjectType::TrackSection);
    }

    #[test]
    fn obj_type_from_wrong_param() {
        let res = ObjectType::from_param("ObjectType").unwrap_err();
        assert_eq!(res, "ObjectType");
    }
}
