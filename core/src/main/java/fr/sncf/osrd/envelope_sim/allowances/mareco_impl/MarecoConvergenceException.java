package fr.sncf.osrd.envelope_sim.allowances.mareco_impl;

import fr.sncf.osrd.exceptions.OSRDError;

public class MarecoConvergenceException extends OSRDError {

    private static final long serialVersionUID = -4300915709988986248L;
    public static final String osrdErrorType = "mareco_convergence";
    public final String marecoErrorType;

    private MarecoConvergenceException(
            String message,
            ErrorCause cause,
            String marecoErrorType
    ) {
        super(message, cause);
        this.marecoErrorType = marecoErrorType;
    }

    /** Generates an error from a discontinuity in mareco search */
    public static MarecoConvergenceException discontinuity() {
        return new MarecoConvergenceException(
                "Mareco failed to converge when computing allowances because of a discontinuity in the search space",
                ErrorCause.INTERNAL,
                "discontinuity"
        );
    }

    /** Generates an error from setting were we can't go slow enough */
    public static MarecoConvergenceException tooMuchTime() {
        return new MarecoConvergenceException(
                "We could not go slow enough in this setting to match the given allowance time",
                ErrorCause.USER,
                "too_much_time"
        );
    }

    /** Generates an error from setting were we can't go fast enough */
    public static MarecoConvergenceException notEnoughTime() {
        return new MarecoConvergenceException(
                "We could not go fast enough in this setting to match the given allowance time",
                ErrorCause.INTERNAL,
                "not_enough_time"
        );
    }
}
