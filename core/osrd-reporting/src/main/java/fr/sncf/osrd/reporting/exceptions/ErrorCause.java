package fr.sncf.osrd.reporting.exceptions;

import com.squareup.moshi.Json;

public enum ErrorCause {
    @Json(name = "Internal")
    INTERNAL,
    @Json(name = "User")
    USER
}
