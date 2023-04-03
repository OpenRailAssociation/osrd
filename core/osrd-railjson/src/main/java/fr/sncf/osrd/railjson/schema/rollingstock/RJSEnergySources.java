package fr.sncf.osrd.railjson.schema.rollingstock;

public class RJSEnergySources {
    /** Floor power limit : the max power the source can capture (<=0) */
    public double maxInputPower;

    /** Ceiling power limit : the max power the source can provide (>=0)*/
    public double maxOutputPower;

    /** The energy storage object of the energy source */
    public RJSEnergyStorage storage;

    public RJSSpeedDependantPowerCoefficient speedCoef;

    /** The efficiency of the battery, between 0 and 1 */
    public double efficiency;
}
