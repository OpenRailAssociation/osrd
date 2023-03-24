package fr.sncf.osrd.envelope_sim.power;

public interface EnergySource {

    /** Return value restricted by EnergySource's Ceiling and Floor power limits : ES.pMin <= return <= ES.pMax*/
    public double clampPowerLimits(double power);

    /** Return available power based on contextual speed */
    public double getPower(double speed);
}
