package fr.sncf.osrd.envelope_sim.allowances.utils;

import fr.sncf.osrd.exceptions.OSRDError;

public class AllowanceConvergenceException extends OSRDError {

    private static final long serialVersionUID = 2130748645658059205L;
    public static final String osrdErrorType = "allowance_convergence";
    public final String errorType;

    private AllowanceConvergenceException(
            String message,
            ErrorCause cause,
            String marecoErrorType
    ) {
        super(message, cause);
        this.errorType = marecoErrorType;
    }

    /** Generates an error from a discontinuity in allowance binary search */
    public static AllowanceConvergenceException discontinuity() {
        return new AllowanceConvergenceException(
                "Failed to converge when computing allowances because of a discontinuity in the search space",
                ErrorCause.INTERNAL,
                "discontinuity"
        );
    }

    /** Generates an error from setting were we can't go slow enough */
    public static AllowanceConvergenceException tooMuchTime() {
        return new AllowanceConvergenceException(
                "We could not go slow enough in this setting to match the given allowance time",
                ErrorCause.USER,
                "too_much_allowance_time"
        );
    }

    /** Generates an error from setting were we can't go fast enough */
    public static AllowanceConvergenceException notEnoughTime() {
        return new AllowanceConvergenceException(
                "We could not go fast enough in this setting to match the given allowance time",
                ErrorCause.INTERNAL,
                "not_enough_allowance_time"
        );
    }
}
