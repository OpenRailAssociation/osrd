use std::marker::PhantomData;

use crate::error::{ApiResult, EditoastError};
use rocket::http::{RawStr, Status};
use rocket::request::FromFormValue;

/// This parameter is used to deserialized a list of `T`
#[derive(Debug)]
pub struct List<'f, T: FromFormValue<'f>>(pub ApiResult<Vec<T>>, PhantomData<&'f T>);

impl<'f, T: FromFormValue<'f>> List<'f, T> {
    pub fn new(v: Vec<T>) -> Self {
        Self(Ok(v), PhantomData)
    }
}

impl<'f, T: FromFormValue<'f>> FromFormValue<'f> for List<'f, T> {
    type Error = ();

    fn from_form_value(form_value: &'f RawStr) -> Result<Self, Self::Error> {
        let mut res = vec![];
        if !form_value.is_empty() {
            for element in form_value.split(',') {
                let element = RawStr::from_str(element);
                match T::from_form_value(element) {
                    Ok(el) => res.push(el),
                    Err(_) => {
                        return Ok(List(
                            Err(EditoastError::create(
                                "editoast:views:params:List",
                                format!("Couldn't parse element '{}'", element),
                                Status::BadRequest,
                                None,
                            )),
                            PhantomData,
                        ));
                    }
                }
            }
        }
        Ok(List::new(res))
    }

    fn default() -> Option<Self> {
        Some(List::new(vec![]))
    }
}
