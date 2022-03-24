package fr.sncf.osrd.new_infra_state.implementation;

import fr.sncf.osrd.exceptions.OSRDError;
import java.io.Serial;

public class SignalizationError extends OSRDError {

    @Serial
    private static final long serialVersionUID = -4664988804881395290L;
    public static final String osrdErrorType = "signalization";

    /** Constructor*/
    protected SignalizationError(String message, ErrorCause errorCause) {
        super(message, errorCause);
    }
}
