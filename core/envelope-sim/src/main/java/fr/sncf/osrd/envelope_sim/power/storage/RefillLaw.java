package fr.sncf.osrd.envelope_sim.power.storage;

public class RefillLaw {
    /** Time constant of the refill behavior <a href="https://en.wikipedia.org/wiki/Time_constant">...</a> */
    double tauRech ;

    /** Set-point of State of charge <a href="https://en.wikipedia.org/wiki/Setpoint_(control_system)">...</a> */
    double socRef;

    /** Gain of the Energy Storage regulation Kp = capacity/tauRech  <=> = Joule·Second^-1 = Watt*/
    double Kp;

    public RefillLaw(double tauRech, double socRef, double EnergyStorageCapacity) {
        this.tauRech = tauRech;
        this.socRef = socRef;
        this.Kp = EnergyStorageCapacity/tauRech;
    }

    /** Return regulated refill power */
    public double getRefillPower(double soc){
        return (socRef-soc)*Kp; //refill power >0 when soc<=socRef
    }
}