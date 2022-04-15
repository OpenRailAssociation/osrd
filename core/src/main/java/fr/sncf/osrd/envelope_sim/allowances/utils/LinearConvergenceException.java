package fr.sncf.osrd.envelope_sim.allowances.utils;

import fr.sncf.osrd.exceptions.OSRDError;

public class LinearConvergenceException extends OSRDError {

    // TODO change this ID
    private static final long serialVersionUID = -4300915709988986248L;
    public static final String osrdErrorType = "linear_convergence";
    public final String linearErrorType;

    private LinearConvergenceException(
            String message,
            ErrorCause cause,
            String marecoErrorType
    ) {
        super(message, cause);
        this.linearErrorType = marecoErrorType;
    }

    /** Generates an error from a discontinuity in linear allowance binary search */
    public static LinearConvergenceException discontinuity() {
        return new LinearConvergenceException(
                "Failed to converge when computing linear allowances because of a discontinuity in the search space",
                ErrorCause.INTERNAL,
                "discontinuity"
        );
    }

    /** Generates an error from setting were we can't go slow enough */
    public static LinearConvergenceException tooMuchTime() {
        return new LinearConvergenceException(
                "We could not go slow enough in this setting to match the given allowance time",
                ErrorCause.USER,
                "too_much_time"
        );
    }

    /** Generates an error from setting were we can't go fast enough */
    public static LinearConvergenceException notEnoughTime() {
        return new LinearConvergenceException(
                "We could not go fast enough in this setting to match the given allowance time",
                ErrorCause.INTERNAL,
                "not_enough_time"
        );
    }
}
