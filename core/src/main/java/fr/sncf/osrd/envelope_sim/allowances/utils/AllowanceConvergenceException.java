package fr.sncf.osrd.envelope_sim.allowances.utils;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.Serial;

public class AllowanceConvergenceException extends OSRDError {

    @Serial
    private static final long serialVersionUID = 2130748645658059205L;
    public static final String osrdErrorType = "allowance_convergence";
    public final ErrorType errorType;

    public enum ErrorType {
        DISCONTINUITY,
        TOO_MUCH_TIME,
        NOT_ENOUGH_TIME
    }

    private AllowanceConvergenceException(
            String message,
            ErrorCause cause,
            ErrorType marecoErrorType
    ) {
        super(message, cause);
        this.errorType = marecoErrorType;
    }

    /** Generates an error from a discontinuity in allowance binary search */
    public static AllowanceConvergenceException discontinuity() {
        return new AllowanceConvergenceException(
                "Failed to converge when computing allowances because of a discontinuity in the search space",
                ErrorCause.INTERNAL,
                ErrorType.DISCONTINUITY
        );
    }

    /** Generates an error from setting were we can't go slow enough */
    public static AllowanceConvergenceException tooMuchTime() {
        return new AllowanceConvergenceException(
                "We could not go slow enough in this setting to match the given allowance time",
                ErrorCause.USER,
                ErrorType.TOO_MUCH_TIME
        );
    }

    /** Generates an error from setting were we can't go fast enough */
    public static AllowanceConvergenceException notEnoughTime() {
        return new AllowanceConvergenceException(
                "We could not go fast enough in this setting to match the given allowance time",
                ErrorCause.INTERNAL,
                ErrorType.NOT_ENOUGH_TIME
        );
    }
}
