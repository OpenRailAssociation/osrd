package fr.sncf.osrd.path.legacy_objects.electrification;

import fr.sncf.osrd.path.interfaces.Electrification;

public class NonElectrified implements Electrification {
    @Override
    public Electrification withElectricalProfile(String profile) {
        return this;
    }

    @Override
    public Electrification withPowerRestriction(String powerRestriction) {
        return this;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof NonElectrified;
    }

    @Override
    public int hashCode() {
        return 0;
    }
}
