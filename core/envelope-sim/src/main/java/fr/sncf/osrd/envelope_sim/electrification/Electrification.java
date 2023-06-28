package fr.sncf.osrd.envelope_sim.electrification;

public sealed interface Electrification permits Electrified, Neutral, NonElectrified {
    Electrification withElectricalProfile(String profile);

    Electrification withPowerRestriction(String powerRestriction);

    boolean equals(Object o);
}
