package fr.sncf.osrd.railjson.schema.rollingstock;

public class RJSEnergySources {
    /** The type of energy source */
    public RJSEnergySourceType type;

    /** Floor power limit : the max power the source can capture */
    public RJSSpeedDependantPower maxInputPower;

    /** Ceiling power limit : the max power the source can provide */
    public RJSSpeedDependantPower maxOutputPower;

    /** The energy storage object of the energy source */
    public RJSEnergyStorage storage;

    /** The efficiency of the source, between 0 and 1 */
    public double efficiency;
}
