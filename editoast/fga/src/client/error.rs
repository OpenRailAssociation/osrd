//! Error codes are extracted from OpenFGA Protobuf spec: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto

#[derive(Debug, thiserror::Error, serde::Deserialize)]
#[serde(untagged)]
pub enum Error {
    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}[{}]: {message}", *code as u16)]
    Auth {
        code: AuthErrorCode,
        message: String,
    },

    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}[{}]: {message}", *code as u16)]
    Validation { code: ErrorCode, message: String },

    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}[{}]: {message}", *code as u16)]
    UnprocessableContent {
        code: UnprocessableContentErrorCode,
        message: String,
    },

    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}[{}]: {message}", *code as u16)]
    Internal {
        code: InternalErrorCode,
        message: String,
    },

    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}[{}]: {message}", *code as u16)]
    NotFound {
        code: NotFoundErrorCode,
        message: String,
    },

    /// Standard OpenFGA error: https://github.com/openfga/api/blob/main/openfga/v1/errors_ignore.proto
    #[error("{code}: {message}")]
    Aborted { code: String, message: String },

    /// Custom error indicating we could not parse an identifier we got from OpenFGA
    ///
    /// Shouldn't happen and should result in a 500 or a panic.
    #[error("Cannot parse OpenFGA value identifier as '{expected_type}': '{ident}'")]
    #[serde(skip_deserializing)]
    MalformedValue {
        ident: String,
        expected_type: String,
    },

    /// The error could not be parsed as an OpenFGA error
    #[error("HTTP request to OpenFGA failed: {0}")]
    #[serde(skip_deserializing)]
    Reqwest(#[source] reqwest::Error),
}

impl From<reqwest::Error> for Error {
    fn from(error: reqwest::Error) -> Self {
        #[cfg(any(debug_assertions, test))]
        let error = error;
        #[cfg(all(not(debug_assertions), not(test)))]
        let error = error.without_url();
        Self::Reqwest(error)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::Display, serde::Deserialize)]
#[repr(u16)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum AuthErrorCode {
    NoAuthError = 0,
    AuthFailedInvalidSubject = 1001,
    AuthFailedInvalidAudience = 1002,
    AuthFailedInvalidIssuer = 1003,
    InvalidClaims = 1004,
    AuthFailedInvalidBearerToken = 1005,
    BearerTokenMissing = 1010,
    Unauthenticated = 1500,
    Forbidden = 1600,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::Display, serde::Deserialize)]
#[repr(u16)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum ErrorCode {
    NoError = 0,
    ValidationError = 2000,
    AuthorizationModelNotFound = 2001,
    AuthorizationModelResolutionTooComplex = 2002,
    InvalidWriteInput = 2003,
    CannotAllowDuplicateTuplesInOneRequest = 2004,
    CannotAllowDuplicateTypesInOneRequest = 2005,
    CannotAllowMultipleReferencesToOneRelation = 2006,
    InvalidContinuationToken = 2007,
    InvalidTupleSet = 2008,
    InvalidCheckInput = 2009,
    InvalidExpandInput = 2010,
    UnsupportedUserSet = 2011,
    InvalidObjectFormat = 2012,
    WriteFailedDueToInvalidInput = 2017,
    AuthorizationModelAssertionsNotFound = 2018,
    LatestAuthorizationModelNotFound = 2020,
    TypeNotFound = 2021,
    RelationNotFound = 2022,
    EmptyRelationDefinition = 2023,
    InvalidUser = 2025,
    InvalidTuple = 2027,
    UnknownRelation = 2028,
    StoreIdInvalidLength = 2030,
    AssertionsTooManyItems = 2033,
    IdTooLong = 2034,
    AuthorizationModelIdTooLong = 2036,
    TupleKeyValueNotSpecified = 2037,
    TupleKeysTooManyOrTooFewItems = 2038,
    PageSizeInvalid = 2039,
    ParamMissingValue = 2040,
    DifferenceBaseMissingValue = 2041,
    SubtractBaseMissingValue = 2042,
    ObjectTooLong = 2043,
    RelationTooLong = 2044,
    TypeDefinitionsTooFewItems = 2045,
    TypeInvalidLength = 2046,
    TypeInvalidPattern = 2047,
    RelationsTooFewItems = 2048,
    RelationsTooLong = 2049,
    RelationsInvalidPattern = 2050,
    ObjectInvalidPattern = 2051,
    QueryStringTypeContinuationTokenMismatch = 2052,
    ExceededEntityLimit = 2053,
    InvalidContextualTuple = 2054,
    DuplicateContextualTuple = 2055,
    InvalidAuthorizationModel = 2056,
    UnsupportedSchemaVersion = 2057,
    Cancelled = 2058,
    InvalidStartTime = 2059,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::Display, serde::Deserialize)]
#[repr(u16)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum UnprocessableContentErrorCode {
    NoThrottledErrorCode = 0,
    ThrottledTimeoutError = 3500,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::Display, serde::Deserialize)]
#[repr(u16)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum InternalErrorCode {
    NoInternalError = 0,
    InternalError = 4000,
    DeadlineExceeded = 4004,
    AlreadyExists = 4005,
    ResourceExhausted = 4006,
    FailedPrecondition = 4007,
    Aborted = 4008,
    OutOfRange = 4009,
    Unavailable = 4010,
    DataLoss = 4011,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::Display, serde::Deserialize)]
#[repr(u16)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum NotFoundErrorCode {
    NoNotFoundError = 0,
    UndefinedEndpoint = 5000,
    StoreIdNotFound = 5002,
    Unimplemented = 5004,
}
