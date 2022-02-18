package fr.sncf.osrd.api;

import fr.sncf.osrd.exceptions.OSRDError;
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
            return convertOSRDErrorToResponse((OSRDError) ex);
        else {
            return new RsWithStatus(
                    new RsWithBody(ex.toString()),
                    500
            );
        }
    }

    private static Response convertOSRDErrorToResponse(OSRDError ex) {
        int code = ex.cause == OSRDError.ErrorCause.USER ? 400 : 500;
        return new RsWithStatus(
                new RsJson(
                        new RsWithBody(OSRDError.adapter.toJson(ex))
                ),
                code
        );
    }
}
