package fr.sncf.osrd.new_infra.implementation;

import fr.sncf.osrd.exceptions.OSRDError;
import java.io.Serial;

public class InvalidInfraError extends OSRDError {
    @Serial
    private static final long serialVersionUID = 1480356596960494959L;

    public static final String osrdErrorType = "new_invalid_infra";

    public InvalidInfraError(String message) {
        super(message, ErrorCause.USER);
    }
}
