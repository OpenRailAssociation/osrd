package fr.sncf.osrd.api.pathfinding.response;

import fr.sncf.osrd.reporting.exceptions.OSRDError;

public final class NoPathFoundError extends OSRDError {
    private static final long serialVersionUID = 3786926836815647211L;
    public static final String osrdErrorType = "no_path_found";

    public NoPathFoundError(String message, Throwable cause) {
        super(message, ErrorCause.USER, cause);
    }

    public NoPathFoundError(String message) {
        super(message, ErrorCause.USER);
    }
}