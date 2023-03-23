package fr.sncf.osrd.envelope_sim.power.storage;

public class ManagementSystem{
    double overchargeThreshold;          //overcharge limit
    double underchargeThreshold;         //undercharge limit

    public ManagementSystem(double overchargeThreshold, double underchargeThreshold) {
        this.overchargeThreshold = overchargeThreshold;
        this.underchargeThreshold = underchargeThreshold;
    }
}