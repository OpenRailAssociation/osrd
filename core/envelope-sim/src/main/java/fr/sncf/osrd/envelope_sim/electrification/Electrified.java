package fr.sncf.osrd.envelope_sim.electrification;

import java.util.Objects;

/**
 * Electrification conditions at a point in the path
 */
public non-sealed class Electrified implements Electrification {
    /** Tractive mode the train should use */
    public final String mode;
    /** Electrical profile value (can be null) */
    public final String profile;
    /** Power restriction code (can be null) */
    public final String powerRestriction;

    public Electrified(String mode, String profile, String powerRestriction) {
        this.mode = mode;
        this.profile = profile;
        this.powerRestriction = powerRestriction;
    }

    public Electrified(String mode) {
        this(mode, null, null);
    }

    @Override
    public Electrification withElectricalProfile(String profile) {
        return new Electrified(mode, profile, powerRestriction);
    }

    @Override
    public Electrification withPowerRestriction(String powerRestriction) {
        return new Electrified(mode, profile, powerRestriction);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Electrified other))
            return false;
        return Objects.equals(mode, other.mode)
                && Objects.equals(profile, other.profile)
                && Objects.equals(powerRestriction, other.powerRestriction);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mode, powerRestriction, profile);
    }
}
