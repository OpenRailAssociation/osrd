package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public final class RJSSpeedDependantPower {

    @Json(name = "speeds")
    public double[] speeds = null;
    @Json(name = "powers")
    public double[] powers;
}
