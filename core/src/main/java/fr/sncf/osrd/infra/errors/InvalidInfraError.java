package fr.sncf.osrd.infra.errors;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.Serial;

public class InvalidInfraError extends OSRDError {
    @Serial
    private static final long serialVersionUID = 1480356596960494959L;

    public static final String osrdErrorType = "invalid_infra";

    public InvalidInfraError(String message) {
        super(message, ErrorCause.USER);
    }
}
