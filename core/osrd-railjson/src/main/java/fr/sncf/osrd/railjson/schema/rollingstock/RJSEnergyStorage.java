package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public class RJSEnergyStorage {

    /** How much energy the object can store (in Joules or Watts·Seconds) */
    @Json(name = "capacity")
    public double capacity = Double.NaN;

    /** The State of Charge of the EnergyStorage, soc * capacity = actual stock of energy */
    @Json(name = "soc")
    public double initialSoc = Double.NaN;

    @Json(name = "refill_law")
    public RJSRefillLaw refillLaw = null;

    @Json(name = "soc_min")
    public double socMin = Double.NaN;

    @Json(name = "soc_max")
    public double socMax = Double.NaN;
}
