//! # High-level modelization of OpenFGA authorization models definitions
//!
//! This module exposes a bunch of types and traits that represents everything
//! defined in an OpenFGA authorization model and needed to interact with it.
//!
//! For a small tutorial on how to use this module to represent your authorization
//! model, see the [crate-level documentation](crate).

use core::fmt;
use std::str::FromStr;

/// Representation of an OpenFGA `type`
///
/// In order to be used with the [`trait Relation`], the implementor type
/// must also implement either or both of the [`trait User`] and [`trait Object`].
///
/// The implementor type must also implement [std::str::FromStr] in order to be constructed
/// from values received in OpenFGA responses.
///
/// # Example
///
/// OpenFGA model:
///
/// ```ignore
/// model:
///     schema: 1.1
///
/// type group
/// ```
///
/// Rust representation:
///
/// ```
/// #[derive(Debug, derive_more::FromStr)]
/// struct Group(String);
///
/// impl fga::model::Type for Group {
///     const NAMESPACE: &'static str = "group";
///
///     fn id(&self) -> impl ToString {
///         &self.0
///     }
/// }
/// ```
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-type-definition>
pub trait Type: FromStr + Sized {
    /// The name of the OpenFGA `type`
    const NAMESPACE: &'static str;

    /// The identifier of the instance of the `type` `Self`
    fn id(&self) -> impl ToString;
}

/// Representation of an OpenFGA type that can be used as an OpenFGA user (tuple position)
///
/// The implementor type must also implement [std::str::FromStr] in order to be constructed
/// from values received in OpenFGA responses.
///
/// # Example
///
/// OpenFGA model:
///
/// ```ignore
/// model:
///    schema: 1.1
///
/// type person
/// ```
///
/// Rust representation:
///
/// ```
/// #[derive(Debug, derive_more::FromStr)]
/// struct Person(String);
///
/// impl fga::model::Type for Person {
///     const NAMESPACE: &'static str = "person";
///
///     fn id(&self) -> impl ToString {
///         &self.0
///     }
/// }
///
/// // can be used with the trait methods default implementations or have them overriden
/// impl fga::model::User for Person {}
/// ```
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-user>
pub trait User: Type + fmt::Debug + Sized {
    /// Builds the OpenFGA USER string from a [`User`] instance
    ///
    /// This string is sent to OpenFGA to represent the USER in a tuple.
    ///
    /// # Example
    ///
    /// ```
    /// # use fga::fga;
    /// # use fga::model::User;
    /// # use fga::model::Type;
    /// # #[derive(Debug, derive_more::FromStr)]
    /// # struct Person(String);
    /// # impl Type for Person { const NAMESPACE: &'static str = "person"; fn id(&self) -> impl ToString { &self.0 } }
    /// impl User for Person {}
    /// assert_eq!(Person::NAMESPACE, "person");
    /// assert_eq!(fga!(Person:"bob").fga_user(), "person:bob");
    /// ```
    ///
    /// # About security and panics
    ///
    /// This function will panic **by default** if the user identifier is `*`.
    /// This is a security measure to avoid having user identifiers coerced to
    /// public accesses maliciously. For example, without the panic, the following
    /// injection would be possible:
    ///
    /// ```
    /// # include!("doctest_setup.rs");
    /// # #[tokio::main]
    /// # async fn main() {
    /// # let user_provided_data = "*".to_string();
    /// assert_eq!(user_provided_data, "*");
    /// let user = Person(user_provided_data);
    /// let object = Document("confidential".to_string());
    /// let tuple = Document::can_read().tuple(&user, &object);
    /// // write the tuple
    /// // now the topsecret document is public and the world burns
    /// # }
    /// ```
    ///
    /// To grant public accesses, the [`Wildcard`] should be used to ensure a different
    /// code path.
    ///
    /// If this function is overridden, **unless you absolutely know what you're doing**,
    /// a panic should be triggered when `self.id() == "*"`.
    fn fga_user(&self) -> String {
        let id = self.id().to_string();
        if id == "*" {
            panic!(
                "Refusing to generate an identifier for a type-bound public access\n\
                without using the `fga::model::Wildcard` type.\n\
                This is a security measure to avoid having user identifiers coerced to\n\
                public accesses maliciously."
            );
        }
        format!("{}:{}", Self::NAMESPACE, id)
    }

    /// Returns the [`Wildcard`] type for this user type
    ///
    /// This function probably shouldn't be overridden.
    fn wildcard() -> Wildcard<Self> {
        Wildcard(std::marker::PhantomData)
    }
}

/// Representation of an OpenFGA relation
///
/// While implementable manually, it is recommended to use the [`relations!()`](super::relations!)
/// macro to generate the necessary boilerplate.
///
/// The functions defined in this trait are used to build OpenFGA objects and queries
/// in a type-safe way. They are not made to be overridden. If you decide to do so,
/// make sure their behavior still makes sense for OpenFGA.
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-relation>
pub trait Relation: fmt::Debug + Sized {
    /// The name of the relation as defined in the OpenFGA model
    const NAME: &'static str;

    /// The type of the USER side of the relation
    ///
    /// While OpenFGA supports multiple types of users, `fga` only supports
    /// a single type by design. However, it may be possible to implement [`trait User`]
    /// for an enum which variants would represent the different types of users.
    /// This is outside the scope of `fga` though.
    type User: User;

    /// The type of the OBJECT side of the relation
    type Object: Object;

    // ----- Related objects

    /// Builds a tuple object
    ///
    /// Can be written in OpenFGA using
    /// [`Client::write_tuples`](crate::client::Client::write_tuples)
    /// or
    /// [`Client::prepare_writes`](crate::client::Client::prepare_writes).
    fn tuple<'a, U: AsUser<User = Self::User>>(
        &self,
        user: U,
        object: &'a Self::Object,
    ) -> Tuple<'a, Self, U> {
        Tuple { user, object }
    }

    /// Builds a userset object
    ///
    /// Can be used in the USER part of a tuple in [`Relation::tuple`] or [`Relation::query_objects`].
    fn userset<'a>(&self, object: &'a Self::Object) -> UserSet<'a, Self> {
        UserSet(object)
    }

    // ----- Queries

    /// Builds a check query
    ///
    /// Can be used in [`Client::check`](crate::client::Client::check) to check if `user`
    /// is related via `Self` to `object`.
    fn check<'a, U: AsUser<User = Self::User>>(
        &self,
        user: U,
        object: &'a Self::Object,
    ) -> Check<'a, Self, U> {
        Check { user, object }
    }

    /// Builds a user list query
    ///
    /// Can be used in [`Client::list_users`](crate::client::Client::list_users) to
    /// compute which users are related to `object` via `Self`.
    fn query_users<'a>(&self, object: &'a Self::Object) -> QueryUsers<'a, Self> {
        QueryUsers(object)
    }

    /// Builds a userset list query
    ///
    /// Can be used in [`Client::list_usersets`](crate::client::Client::list_usersets) to
    /// compute which usersets are related to `object` via `Self`.
    fn query_usersets<'a, R: Relation>(
        &self,
        _userset_relation: R,
        object: &'a Self::Object,
    ) -> QueryUsersets<'a, Self, R> {
        QueryUsersets(object, std::marker::PhantomData)
    }

    /// Builds an object list query
    ///
    /// Can be used in [`Client::list_objects`](crate::client::Client::list_objects) to
    /// compute which objects are related to `user` via `Self`.
    fn query_objects<U: AsUser<User = Self::User>>(&self, user: U) -> QueryObjects<Self, U> {
        QueryObjects::<Self, U>(user, std::marker::PhantomData)
    }

    // tuple_key = { user: user:bob, relation: reader, object: document: }
    /// NOT YET IMPLEMENTED
    fn query_objects_stored<'a>(&self, user: &'a Self::User) -> QueryObjectsStored<'a, Self> {
        let _ = user;
        todo!()
    }

    // tuple_key = { object: document:budget-2021, relation: reader }
    /// NOT YET IMPLEMENTED
    fn query_users_stored<'a>(&self, object: &'a Self::Object) -> QueryUsersStored<'a, Self> {
        let _ = object;
        todo!()
    }
}

/// Representation of an OpenFGA type that can be used as an OpenFGA object (tuple position)
///
/// The implementor type must also implement [std::str::FromStr] in order to be constructed
/// from values received in OpenFGA responses.
///
/// # Example
///
/// OpenFGA model:
///
/// ```ignore
/// model:
///    schema: 1.1
///
/// type document
/// ```
///
/// Rust representation:
///
/// ```
/// #[derive(Debug, derive_more::FromStr)]
/// struct Document(String);
///
/// impl fga::model::Type for Document {
///     const NAMESPACE: &'static str = "document";
///
///     fn id(&self) -> impl ToString {
///         &self.0
///     }
/// }
///
/// // can be used with the trait methods default implementations or have them overriden
/// impl fga::model::Object for Document {}
/// ```
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-an-object>
pub trait Object: Type + fmt::Debug {
    /// Builds the OpenFGA OBJECT string from an [`Object`] instance
    ///
    /// This string is sent to OpenFGA to represent the OBJECT in a tuple.
    ///
    /// # Example
    ///
    /// ```
    /// # use fga::fga;
    /// # use fga::model::Object;
    /// # use fga::model::Type;
    /// # #[derive(Debug, derive_more::FromStr)]
    /// # struct Document(String);
    /// # impl Type for Document { const NAMESPACE: &'static str = "document"; fn id(&self) -> impl ToString { &self.0 } }
    /// impl Object for Document {}
    /// assert_eq!(Document::NAMESPACE, "document");
    /// assert_eq!(fga!(Document:"budget").fga_object(), "document:budget");
    /// ```
    fn fga_object(&self) -> String {
        format!("{}:{}", Self::NAMESPACE, self.id().to_string())
    }
}

/// Indicates that the implementor can be used in the USER position of a tuple
///
/// According to <https://openfga.dev/docs/concepts#what-is-a-user>, a user can be one of:
///
/// 1. A regular user `user:identifier` — represented by the [`trait User`]
/// 2. A userset `object:identifier#relation` — represented by the [`struct UserSet`]
/// 3. A type-bound public access `user:*` — represented by the [`struct Wildcard`]
///
/// All these values can be used in the USER position of a tuple, and therefore must be accepted
/// by queries builders, such as [`Relation::query_objects`].
///
/// Auto-implemented for types that implement [`trait User`].
pub trait AsUser {
    /// The USER type that the implementor can be used as
    type User: User;

    /// Builds the OpenFGA USER string from an [`AsUser`] instance
    ///
    /// This string is sent to OpenFGA to represent the USER in a tuple.
    ///
    /// Has the same semantics as [`User::fga_user`].
    fn fga_user(&self) -> String;
}

impl<U: User> AsUser for &U {
    type User = U;

    fn fga_user(&self) -> String {
        Self::User::fga_user(self)
    }
}

/// A check query built by [`Relation::check`]
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-check-request>
#[derive(Debug)]
pub struct Check<'a, R: Relation, U: AsUser<User = R::User>> {
    pub(crate) user: U,
    pub(crate) object: &'a R::Object,
}

/// A list object query built by [`Relation::query_objects`]
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-list-objects-request>
#[derive(Debug)]
pub struct QueryObjects<R: Relation, U: AsUser<User = R::User>>(
    pub(crate) U,
    pub(crate) std::marker::PhantomData<R>,
);

/// A list user query built by [`Relation::query_users`]
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-list-users-request>
#[derive(Debug)]
pub struct QueryUsers<'a, R: Relation>(pub(crate) &'a R::Object);

/// A list user query specialized for usersets built by [`Relation::query_usersets`]
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-list-users-request>
#[derive(Debug)]
pub struct QueryUsersets<'a, R: Relation, S: Relation>(
    pub(crate) &'a R::Object,
    pub(crate) std::marker::PhantomData<S>,
);

#[expect(unused)]
#[derive(Debug)]
pub struct QueryObjectsStored<'a, R: Relation>(&'a R::User);
#[expect(unused)]
#[derive(Debug)]
pub struct QueryUsersStored<'a, R: Relation>(&'a R::Object);

/// A type-safe OpenFGA tuple representation built by [`Relation::tuple`]
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-relationship-tuple>
#[derive(Debug)]
pub struct Tuple<'a, R, U>
where
    R: Relation,
    U: AsUser<User = R::User>,
{
    pub(crate) user: U,
    pub(crate) object: &'a R::Object,
}

impl<R: Relation, U: AsUser<User = R::User>> PartialEq for Tuple<'_, R, U>
where
    U: PartialEq,
    R::Object: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.user == other.user && self.object == other.object
    }
}

/// User set: `group:my-team#member`, `infra:france#can_read`, etc.
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-a-user>
#[derive(Debug, Clone, Copy)]
pub struct UserSet<'a, R: Relation + 'static>(&'a R::Object);

impl<R: Relation> AsUser for UserSet<'_, R> {
    type User = R::User;

    fn fga_user(&self) -> String {
        format!(
            "{}:{}#{}",
            R::Object::NAMESPACE,
            self.0.id().to_string(),
            R::NAME
        )
    }
}

impl<R: Relation> PartialEq for UserSet<'_, R>
where
    R::Object: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<R: Relation> Eq for UserSet<'_, R> where R::Object: Eq {}

/// Type-bound public access: `user:*`, `document:*`, etc.
///
/// # OpenFGA concept
///
/// <https://openfga.dev/docs/concepts#what-is-type-bound-public-access>
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Wildcard<U: User>(pub(crate) std::marker::PhantomData<U>);

impl<U: User> AsUser for Wildcard<U> {
    type User = U;

    fn fga_user(&self) -> String {
        format!("{}:*", U::NAMESPACE)
    }
}

#[cfg(test)]
mod tests {
    use crate::defs;

    use super::*;

    #[test]
    #[should_panic]
    fn public_access_injection_protection_user() {
        let _ = User::fga_user(&defs::User("*".to_owned()));
    }

    #[test]
    #[should_panic]
    fn public_access_injection_protection_user_asuser() {
        let _ = AsUser::fga_user(&&defs::User("*".to_owned()));
    }

    #[test]
    fn no_injection_protection_for_wildcard() {
        let _ = defs::Group::wildcard();
    }
}
