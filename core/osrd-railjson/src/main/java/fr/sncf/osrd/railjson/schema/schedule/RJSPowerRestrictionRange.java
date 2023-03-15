package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;

public class RJSPowerRestrictionRange {
    @Json(name = "begin_position")
    public double beginPosition;

    @Json(name = "end_position")
    public double endPosition;

    @Json(name = "power_restriction_code")
    public String powerRestrictionCode;

    public RJSPowerRestrictionRange(
            double beginPosition,
            double endPosition,
            String powerRestrictionCode
    ) {
        this.beginPosition = beginPosition;
        this.endPosition = endPosition;
        this.powerRestrictionCode = powerRestrictionCode;
    }
}
