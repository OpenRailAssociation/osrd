package fr.sncf.osrd.api;

import com.squareup.moshi.Json;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
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
            return toResponse((OSRDError) ex);
        else if (ex instanceof AssertionError)
            return toResponse(new AssertWrapper((AssertionError) ex));
        else {
            return new RsWithStatus(
                    new RsWithBody(ex.toString()),
                    500
            );
        }
    }

    /** Converts an OSRD error to a server response */
    public static Response toResponse(OSRDError ex) {
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

        @Json(name = "assert_message")
        public final String assertMessage;

        @Json(name = "stack_trace")
        public final List<String> stackTrace;

        protected AssertWrapper(AssertionError ex) {
            super(ex.getMessage(), ErrorCause.INTERNAL);
            this.assertMessage = ex.getMessage();
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
