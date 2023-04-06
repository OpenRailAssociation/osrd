package fr.sncf.osrd.envelope_sim.power;

public interface EnergySource {

    /** Return available power based on contextual speed and electrification availability */
    double getMaxOutputPower(double speed, boolean electrification);

    /** Return the maximum refill power the source is capable of capturing */
    double getMaxInputPower(double speed);

    /** Consume a given amount of energy from the source.*/
    void consumeEnergy(double energyDelta);

    /** Send a given amount of energy to the source.*/
    void sendEnergy(double energyDelta);

    /** Get the priority of the energySource.
     *  The higher the priority, the more we want to save energy from this source, so we'll try to get
     *  output power from lower priority sources first */
    int getPriority();
}
