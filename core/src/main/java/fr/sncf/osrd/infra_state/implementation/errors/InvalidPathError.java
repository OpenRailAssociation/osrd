package fr.sncf.osrd.infra_state.implementation.errors;

import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;

public class InvalidPathError extends InvalidSchedule {
    public static final String osrdErrorType = "invalid_path";
    private static final long serialVersionUID = 8060418418640723621L;

    /** Constructor */
    public InvalidPathError(String message) {
        super(message);
    }
}
