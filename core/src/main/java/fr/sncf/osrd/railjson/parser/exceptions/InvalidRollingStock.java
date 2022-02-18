package fr.sncf.osrd.railjson.parser.exceptions;

import fr.sncf.osrd.exceptions.OSRDError;

public class InvalidRollingStock extends OSRDError {
    private static final long serialVersionUID = -8380552148316200567L;
    public static final String osrdErrorType = "invalid_rolling_stock";

    public InvalidRollingStock(String message) {
        super(message, ErrorCause.USER);
    }

    public InvalidRollingStock() {
        this("Invalid rolling stock");
    }
}
