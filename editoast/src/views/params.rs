use std::marker::PhantomData;

use rocket::form::{self, FromFormField, ValueField};

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
