package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;

public final class RJSAllowanceRange {
    @Json(name = "begin_position")
    public double beginPos;
    @Json(name = "end_position")
    public double endPos;
    public RJSAllowanceValue value;

    /** Constructor */
    public RJSAllowanceRange(
            double beginPos,
            double endPos,
            RJSAllowanceValue value) {
        this.beginPos = beginPos;
        this.endPos = endPos;
        this.value = value;
    }

    /** Constructor */
    @SuppressWarnings("unused")
    public RJSAllowanceRange() {
        this.beginPos = Double.NaN;
        this.endPos = Double.NaN;
        this.value = null;
    }
}
