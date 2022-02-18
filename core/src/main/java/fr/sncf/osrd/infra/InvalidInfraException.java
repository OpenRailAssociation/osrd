package fr.sncf.osrd.infra;

import fr.sncf.osrd.exceptions.OSRDError;

public class InvalidInfraException extends OSRDError {
    private static final long serialVersionUID = -8946928669397353451L;
    public static final String osrdErrorType = "invalid_infra";

    public InvalidInfraException(String message) {
        super(message, ErrorCause.USER);
    }
}
