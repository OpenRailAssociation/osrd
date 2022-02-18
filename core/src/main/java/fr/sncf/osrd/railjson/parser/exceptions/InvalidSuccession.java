package fr.sncf.osrd.railjson.parser.exceptions;

import fr.sncf.osrd.exceptions.OSRDError;

public class InvalidSuccession extends OSRDError {
    private static final long serialVersionUID = -3695562224328844732L;
    public static final String osrdErrorType = "invalid_succession";

    public InvalidSuccession(String message) {
        super(message, ErrorCause.USER);
    }

    public InvalidSuccession() {
        this("invalid succession");
    }
}
