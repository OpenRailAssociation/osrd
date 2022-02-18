package fr.sncf.osrd.railjson.parser.exceptions;

import fr.sncf.osrd.exceptions.OSRDError;

public class InvalidSchedule extends OSRDError {
    private static final long serialVersionUID = 5681057974753003734L;
    public static final String osrdErrorType = "invalid_schedule";

    public InvalidSchedule(String message) {
        super(message, ErrorCause.USER);
    }
}
