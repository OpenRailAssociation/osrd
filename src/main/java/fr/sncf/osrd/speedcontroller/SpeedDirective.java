package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public final class SpeedDirective {
    public double allowedSpeed;

    /** Creates a new speed directive */
    public SpeedDirective(double allowedSpeed) {
        this.allowedSpeed = allowedSpeed;
    }

    public static SpeedDirective getMax() {
        return new SpeedDirective(Double.POSITIVE_INFINITY);
    }

    /**
     * Combine with another speed limit
     * @param directive the speed limit to merge into the current one
     */
    public void mergeWith(SpeedDirective directive) {
        if (directive.allowedSpeed < allowedSpeed)
            allowedSpeed = directive.allowedSpeed;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null || obj.getClass() != SpeedDirective.class)
            return false;
        var other = (SpeedDirective) obj;
        return allowedSpeed == other.allowedSpeed;
    }

    @Override
    public int hashCode() {
        return Objects.hash(allowedSpeed);
    }
}
