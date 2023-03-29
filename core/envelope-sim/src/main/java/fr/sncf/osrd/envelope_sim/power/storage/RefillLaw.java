package fr.sncf.osrd.envelope_sim.power.storage;

public class RefillLaw {
    /** Time constant of the refill behavior, in seconds
     * <a href="https://en.wikipedia.org/wiki/Time_constant">...</a> */
    double tauRech ;

    /** State of charge target, between 0 and 1
     * <a href="https://en.wikipedia.org/wiki/Setpoint_(control_system)">...</a> */
    double socRef;

    /** Gain of the Energy Storage regulation, in Watt
     * Kp = capacity / tauRech */
    double Kp;

    public RefillLaw(double tauRech, double socRef, double energyStorageCapacity) {
        this.tauRech = tauRech;
        this.socRef = socRef;
        this.Kp = energyStorageCapacity / tauRech;
    }

    /** Return regulated refill power */
    public double getRefillPower(double soc){
        return (socRef - soc) * Kp; //refill power >0 when soc<=socRef
    }
}
