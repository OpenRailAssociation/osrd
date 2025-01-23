use core::fmt;

pub trait User: fmt::Debug + Sized {
    const NAMESPACE: &'static str;

    fn id(&self) -> &str;

    fn fga_ident(&self) -> String {
        format!("{}:{}", Self::NAMESPACE, self.id())
    }

    fn tbpa() -> Tbpa<Self> {
        Tbpa(std::marker::PhantomData)
    }
}

pub trait Relation: fmt::Debug + Sized {
    const NAME: &'static str;
    type User: User;
    type Object: Object;

    // ----- Related objects

    fn tuple<'a: 'c, 'b: 'c, 'c, U: AsUser<User = Self::User>>(
        &self,
        user: &'a U,
        object: &'b Self::Object,
    ) -> Tuple<'c, Self, U> {
        Tuple { user, object }
    }

    fn userset<'a>(&self, object: &'a Self::Object) -> UserSet<'a, Self> {
        UserSet(object)
    }

    // ----- Queries

    fn check<'a: 'c, 'b: 'c, 'c>(
        &self,
        user: &'a Self::User,
        object: &'b Self::Object,
    ) -> Check<'c, Self> {
        Check { user, object }
    }

    // implicit
    fn query_users<'a>(&'a self, object: &'a Self::Object) -> QueryUsers<'a, Self> {
        QueryUsers(object)
    }

    // implicit
    fn query_objects<'a>(&'a self, user: &'a Self::User) -> QueryObjects<'a, Self> {
        QueryObjects(user)
    }

    // tuple_key = { user: user:bob, relation: reader, object: document: }
    fn query_objects_stored<'a>(&'a self, user: &'a Self::User) -> QueryObjectsStored<'a, Self> {
        QueryObjectsStored(user)
    }

    // tuple_key = { object: document:budget-2021, relation: reader }
    fn query_users_stored<'a>(&'a self, object: &'a Self::Object) -> QueryUsersStored<'a, Self> {
        QueryUsersStored(object)
    }
}

pub trait Object: fmt::Debug {
    const NAMESPACE: &'static str;

    fn id(&self) -> &str;

    fn fga_ident(&self) -> String {
        format!("{}:{}", Self::NAMESPACE, self.id())
    }
}

pub trait AsUser {
    type User: User;

    fn id(&self) -> &str;

    fn fga_ident(&self) -> String {
        format!("{}:{}", Self::User::NAMESPACE, self.id())
    }
}

impl<U: User> AsUser for U {
    type User = U;

    fn id(&self) -> &str {
        Self::User::id(&self)
    }
}

#[derive(Debug)]
pub struct Check<'a, R: Relation> {
    pub(crate) user: &'a R::User,
    pub(crate) object: &'a R::Object,
}
pub struct QueryObjects<'a, R: Relation>(&'a R::User);
pub struct QueryUsers<'a, R: Relation>(&'a R::Object);
pub struct QueryObjectsStored<'a, R: Relation>(&'a R::User);
pub struct QueryUsersStored<'a, R: Relation>(&'a R::Object);

pub struct Tuple<'a, R, U>
where
    R: Relation,
    U: AsUser<User = R::User>,
{
    pub(crate) user: &'a U,
    pub(crate) object: &'a R::Object,
}

/// User set: `group:toto#member`, `infra:france#can_read`
pub struct UserSet<'a, R: Relation + 'static>(&'a R::Object);

impl<'a, R: Relation> AsUser for UserSet<'a, R> {
    type User = R::User;

    fn id(&self) -> &str {
        self.0.id()
    }

    fn fga_ident(&self) -> String {
        format!("{}:{}#{}", Self::User::NAMESPACE, self.id(), R::NAME)
    }
}

/// Type-bound public access: `user:*`, `document:*`, etc.
///
/// Note: doesn't derive [Object] as prohibited by OpenFGA: https://openfga.dev/docs/concepts#what-is-type-bound-public-access
pub struct Tbpa<U: User>(std::marker::PhantomData<U>);

impl<U: User> AsUser for Tbpa<U> {
    type User = U;

    fn id(&self) -> &str {
        &"*"
    }
}

impl<R: Relation, U: AsUser<User = R::User>> serde::Serialize for Tuple<'_, R, U> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap as _;
        let mut map = serializer.serialize_map(Some(3))?;
        map.serialize_entry("user", &self.user.fga_ident())?;
        map.serialize_entry("relation", R::NAME)?;
        map.serialize_entry("object", &self.object.fga_ident())?;
        map.end()
    }
}
