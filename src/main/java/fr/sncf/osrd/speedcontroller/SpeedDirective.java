package fr.sncf.osrd.speedcontroller;

public class SpeedDirective {
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
}
