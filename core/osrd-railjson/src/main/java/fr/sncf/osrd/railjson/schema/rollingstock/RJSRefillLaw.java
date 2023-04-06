package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public class RJSRefillLaw {
    /** Time constant of the refill behavior, in seconds
     * <a href="https://en.wikipedia.org/wiki/Time_constant">...</a> */
    @Json(name = "tau")
    public double tauRech = Double.NaN;

    /** State of charge target, between 0 and 1
     * <a href="https://en.wikipedia.org/wiki/Setpoint_(control_system)">...</a> */
    @Json(name = "soc_ref")
    public double socRef = Double.NaN;

    /** Gain of the Energy Storage regulation, in Watt
     * Kp = capacity / tauRech */
    public double Kp;
}
