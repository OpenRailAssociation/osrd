package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;

public class RJSEnergySource {
    /** The type of energy source */
    @Json(name = "type")
    public RJSEnergySourceType type;

    /** Floor power limit : the max power the source can capture */
    @Json(name = "max_input_power")
    public RJSSpeedDependantPower maxInputPower = null;

    /** Ceiling power limit : the max power the source can provide */
    @Json(name = "max_output_power")
    public RJSSpeedDependantPower maxOutputPower = null;

    /** The energy storage object of the energy source */
    @Json(name = "energy_storage")
    public RJSEnergyStorage storage = null;

    /** The efficiency of the source, between 0 and 1 */
    @Json(name = "efficiency")
    public double efficiency = Double.NaN;
}
