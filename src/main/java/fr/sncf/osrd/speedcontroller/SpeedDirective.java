package fr.sncf.osrd.speedcontroller;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Objects;

public final class SpeedDirective {
    public double allowedSpeed;
    public double warningSpeed;
    public double emergencyBrakingSpeed;

    public boolean coast;

    /**
     * Creates a new set of speed directives a driver should abide by.
     * @param allowedSpeed a soft speed limit
     * @param warningSpeed the speed at which the driver should get a warning
     * @param emergencyBrakingSpeed the speed at which the train should brake by itself
     * @param coast whether the train should coast
     */
    public SpeedDirective(double allowedSpeed, double warningSpeed, double emergencyBrakingSpeed, boolean coast) {
        this.allowedSpeed = allowedSpeed;
        this.warningSpeed = warningSpeed;
        this.emergencyBrakingSpeed = emergencyBrakingSpeed;
        this.coast = coast;
    }

    public static SpeedDirective allowedOnly(double allowedSpeed) {
        return new SpeedDirective(allowedSpeed, Double.NaN, Double.NaN, false);
    }

    public static SpeedDirective coast() {
        return new SpeedDirective(Double.NaN, Double.NaN, Double.NaN, true);
    }

    public static SpeedDirective maxLimits() {
        return new SpeedDirective(Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, false);
    }

    /**
     * Combine with another speed limit
     * @param directive the speed limit to merge into the current one
     */
    public final void mergeWith(SpeedDirective directive) {
        if (directive.allowedSpeed < allowedSpeed)
            allowedSpeed = directive.allowedSpeed;
        if (directive.warningSpeed < warningSpeed)
            warningSpeed  = directive.warningSpeed;
        if (directive.emergencyBrakingSpeed < emergencyBrakingSpeed)
            emergencyBrakingSpeed = directive.emergencyBrakingSpeed;
        if (directive.coast)
            coast = true;
    }

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != SpeedDirective.class)
            return false;
        var other = (SpeedDirective) obj;
        return allowedSpeed == other.allowedSpeed
                && warningSpeed == other.warningSpeed
                && emergencyBrakingSpeed == other.emergencyBrakingSpeed
                && coast == other.coast;
    }

    @Override
    public int hashCode() {
        return Objects.hash(allowedSpeed, warningSpeed, emergencyBrakingSpeed, coast);
    }
}
