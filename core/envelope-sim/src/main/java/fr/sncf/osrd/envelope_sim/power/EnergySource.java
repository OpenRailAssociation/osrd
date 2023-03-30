package fr.sncf.osrd.envelope_sim.power;

public interface EnergySource {

    /** Return available power based on contextual speed and electrification availability*/
    double getPower(double speed, boolean electrification);

    /** Return whether the energy source has an energy storage object */
    void updateStorage(double energyDelta);
}
