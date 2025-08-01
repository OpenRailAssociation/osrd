package fr.sncf.osrd.path.legacy_objects.electrification;

import fr.sncf.osrd.path.interfaces.Electrification;
import java.util.Objects;

/** Neutral electrification conditions at a point in the path */
public final class Neutral implements Electrification {
    /** Whether the pantograph should be lowered */
    public boolean lowerPantograph;

    /** Whether this section is an announcement */
    public boolean isAnnouncement;

    /** The electrification that would have been used if it wasn't for this NeutralSection */
    public Electrification overlappedElectrification;

    public Neutral(boolean lowerPantograph, Electrification overlappedElectrification, boolean isAnnouncement) {
        this.lowerPantograph = lowerPantograph;
        assert overlappedElectrification != null && !(overlappedElectrification instanceof Neutral);
        this.overlappedElectrification = overlappedElectrification;
        this.isAnnouncement = isAnnouncement;
    }

    @Override
    public Electrification withElectricalProfile(String profile) {
        return new Neutral(lowerPantograph, overlappedElectrification.withElectricalProfile(profile), isAnnouncement);
    }

    @Override
    public Electrification withPowerRestriction(String powerRestriction) {
        return new Neutral(
                lowerPantograph, overlappedElectrification.withPowerRestriction(powerRestriction), isAnnouncement);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Neutral other)) return false;
        return lowerPantograph == other.lowerPantograph
                && isAnnouncement == other.isAnnouncement
                && overlappedElectrification.equals(other.overlappedElectrification);
    }

    @Override
    public int hashCode() {
        return Objects.hash(lowerPantograph, overlappedElectrification, isAnnouncement);
    }
}
