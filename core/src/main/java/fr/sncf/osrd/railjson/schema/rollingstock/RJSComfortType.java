package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public enum RJSComfortType {
    @Json(name = "ac")
    AC,
    @Json(name = "heating")
    HEATING
}
