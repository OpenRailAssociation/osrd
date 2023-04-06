package fr.sncf.osrd.api;

import fr.sncf.osrd.reporting.exceptions.ErrorCause;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import io.sentry.Sentry;
import org.takes.Response;
import org.takes.rs.RsJson;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;

public class ExceptionHandler {

    /** Handles an exception, returns an HTTP response with all relevant information */
    public static Response handle(Throwable ex) {
        ex.printStackTrace();
        Sentry.captureException(ex);
        if (ex instanceof OSRDError)
            return toResponse((OSRDError) ex);
        else if (ex instanceof AssertionError)
            return toResponse(OSRDError.newAssertionWrapper((AssertionError) ex));
        else {
            return new RsWithStatus(
                    new RsWithBody(ex.toString()),
                    500
            );
        }
    }

    /** Converts an OSRD error to a server response */
    public static Response toResponse(OSRDError ex) {
        int code = ex.cause == ErrorCause.USER ? 400 : 500;
        return new RsWithStatus(
                new RsJson(
                        new RsWithBody(OSRDError.adapter.toJson(ex))
                ),
                code
        );
    }
}
