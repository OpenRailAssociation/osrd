package fr.sncf.osrd.envelope_sim.electrification;

import java.util.Objects;

/**
 * Neutral electrification conditions at a point in the path
 */
public non-sealed class Neutral implements Electrification {
    /** Whether the pantograph should be dropped */
    public boolean isDropPantograph;

    /** The electrification that would have been used if it wasn't for this NeutralSection */
    public Electrification overlappedElectrification;

    public Neutral(boolean isDropPantograph, Electrification overlappedElectrification) {
        this.isDropPantograph = isDropPantograph;
        assert overlappedElectrification != null && !(overlappedElectrification instanceof Neutral);
        this.overlappedElectrification = overlappedElectrification;
    }

    @Override
    public Electrification withElectricalProfile(String profile) {
        return new Neutral(isDropPantograph, overlappedElectrification.withElectricalProfile(profile));
    }

    @Override
    public Electrification withPowerRestriction(String powerRestriction) {
        return new Neutral(isDropPantograph, overlappedElectrification.withPowerRestriction(powerRestriction));
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Neutral other))
            return false;
        return isDropPantograph == other.isDropPantograph
                && overlappedElectrification.equals(other.overlappedElectrification);
    }

    @Override
    public int hashCode() {
        return Objects.hash(isDropPantograph, overlappedElectrification);
    }
}
