mod text_array;

use crate::modelsv2::projects;

editoast_common::schemas! {
    projects::schemas(),
}

pub trait Identifiable<T = i64>
where
    T: Clone,
{
    fn get_id(&self) -> T;
}

pub trait PreferredId<T>: Identifiable<T>
where
    T: Clone,
{
    fn id(&self) -> T {
        self.get_id()
    }
}

impl<T: diesel::Identifiable<Id = i64> + Clone> Identifiable for T {
    fn get_id(&self) -> i64 {
        self.clone().id()
    }
}
