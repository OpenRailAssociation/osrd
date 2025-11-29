package fr.sncf.osrd.api;

import fr.sncf.osrd.cli.Response;
import fr.sncf.osrd.cli.RsJson;
import fr.sncf.osrd.cli.RsWithBody;
import fr.sncf.osrd.cli.RsWithStatus;
import fr.sncf.osrd.reporting.exceptions.ErrorCause;
import fr.sncf.osrd.reporting.exceptions.OSRDError;

public class ExceptionHandler {

    /** Handles an exception, returns an HTTP response with all relevant information or
     * re-throw if exception is an OSRDError of type InfraSoftLoadingError */
    public static Response handle(Throwable ex) throws OSRDError {
        ex.printStackTrace();
        if (ex instanceof OSRDError osrdError) {
            if (!osrdError.osrdErrorType.isRecoverable) {
                throw osrdError;
            }
            return toResponse(osrdError);
        } else if (ex instanceof AssertionError) return toResponse(OSRDError.newAssertionWrapper((AssertionError) ex));
        else {
            return toResponse(OSRDError.newUnknownError(ex));
        }
    }

    /** Converts an OSRD error to a server response */
    public static Response toResponse(OSRDError ex) {
        int code = ex.cause == ErrorCause.USER ? 400 : 500;
        return new RsWithStatus(new RsJson(new RsWithBody(OSRDError.adapter.toJson(ex))), code);
    }
}
