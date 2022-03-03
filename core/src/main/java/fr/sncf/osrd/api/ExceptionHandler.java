package fr.sncf.osrd.api;

import fr.sncf.osrd.exceptions.OSRDError;
import io.sentry.Sentry;
import org.takes.Response;
import org.takes.rs.RsJson;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class ExceptionHandler {

    /** Handles an exception, returns an HTTP response with all relevant information */
    public static Response handle(Throwable ex) {
        ex.printStackTrace();
        Sentry.captureException(ex);
        if (ex instanceof OSRDError)
            return convertOSRDErrorToResponse((OSRDError) ex);
        else if (ex instanceof AssertionError)
            return convertOSRDErrorToResponse(new AssertWrapper((AssertionError) ex));
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

    /** Wraps an assertion error as an OSRDError, to report the stack trace with the same formatting as other errors */
    public static class AssertWrapper extends OSRDError {
        public static final String osrdErrorType = "assert_error";
        private static final long serialVersionUID = 1662852082101020410L;

        public final List<String> stackTrace;

        protected AssertWrapper(AssertionError ex) {
            super(ex.getMessage(), ErrorCause.INTERNAL);
            stackTrace = convertStackTrace(ex.getStackTrace());
        }

        private List<String> convertStackTrace(StackTraceElement[] stackTrace) {
            // A StackTraceElement can't be serialized as it is, we convert it to a list of strings
            return Arrays.stream(stackTrace)
                    .map(e -> String.format("%s:%d", e.getFileName(), e.getLineNumber()))
                    .collect(Collectors.toList());
        }
    }
}
