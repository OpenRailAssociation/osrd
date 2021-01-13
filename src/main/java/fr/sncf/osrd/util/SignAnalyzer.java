package fr.sncf.osrd.util;

/**
 * Helps detect sign changes of mathematical functions.
 */
public final class SignAnalyzer {
    public enum SignProfile {
        CONSTANT,
        INCREASING,
        DECREASING,
    }

    private double previousValue = Double.NaN;
    private SignProfile previousProfile = null;

    /**
     * Gives a new value to the analyzer, which returns the sign profile change, or null.
     * @param newValue the new value of the function
     * @return null if no sign change occurred, or the sign change
     */
    public SignProfile feed(double newValue) {
        // if we had no previous value, we can't analyse anything.
        if (Double.isNaN(previousValue)) {
            previousValue = newValue;
            // no profile change occurred, we only have one datapoint
            return null;
        }

        // compute the current sign profile
        SignProfile currentProfile;
        if (newValue > previousValue)
            currentProfile = SignProfile.INCREASING;
        else if (newValue < previousValue)
            currentProfile = SignProfile.DECREASING;
        else
            currentProfile = SignProfile.CONSTANT;

        // update the previous value
        previousValue = newValue;

        // if the profile did not change, return null to signal just that
        if (currentProfile == previousProfile)
            return null;

        // otherwise, return the new function profile
        previousProfile = currentProfile;
        return currentProfile;
    }
}
