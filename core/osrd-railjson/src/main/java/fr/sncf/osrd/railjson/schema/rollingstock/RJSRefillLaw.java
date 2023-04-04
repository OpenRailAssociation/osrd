package fr.sncf.osrd.railjson.schema.rollingstock;

public class RJSRefillLaw {
    /** Time constant of the refill behavior, in seconds
     * <a href="https://en.wikipedia.org/wiki/Time_constant">...</a> */
    public double tauRech ;

    /** State of charge target, between 0 and 1
     * <a href="https://en.wikipedia.org/wiki/Setpoint_(control_system)">...</a> */
    public double socRef;

    /** Gain of the Energy Storage regulation, in Watt
     * Kp = capacity / tauRech */
    public double Kp;
}
