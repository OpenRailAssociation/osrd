package fr.sncf.osrd.reporting.exceptions;

import com.squareup.moshi.JsonAdapter;
import fr.sncf.osrd.reporting.ErrorContext;
import fr.sncf.osrd.reporting.Reflection;
import java.io.Serial;
import java.util.ArrayList;
import java.util.List;

/** Base exception class for the OSRD project. All exceptions in the project should inherit from this.
 *
 * <p>Any type inheriting from this should have a `public static final String osrdErrorType;`
 * with a short code describing the error. It is hierarchical, it is concatenated to the one of the parent class.
 *
 * <p>When an exception is caught, context can be added to it. A context stack will be included in the error report.
 * Example:
 * <pre>
 * {@code
 * try {
 *     train.thingThatMayThrow();
 * } catch (OSRDException e) {
 *     throw e.withContext(new ErrorContext.Train(train.id));
 * }
 * }
 * </pre>
 */
@SuppressWarnings("serial") // Removes the warning about List not being serializable (moshi doesn't support ArrayList)
public abstract class OSRDError extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1197516372515951853L;

    public static final String osrdErrorType = "core";

    /** Detailed error message */
    public final String message;

    /** Stack trace of context */
    public final List<ErrorContext> trace = new ArrayList<>();

    /** Whether this is an internal or user error, used to determine if we send a 400 or 500 code */
    public final ErrorCause cause;

    /** Add context to the exception */
    public OSRDError withContext(ErrorContext context) {
        trace.add(0, context);
        return this;
    }

    public enum ErrorCause {
        INTERNAL,
        USER
    }

    protected OSRDError(String message, ErrorCause cause) {
        this.message = message;
        this.cause = cause;
    }

    protected OSRDError(String message, ErrorCause cause, Throwable e) {
        super(e);
        this.message = message;
        this.cause = cause;
    }

    @Override
    public String getMessage() {
        return message;
    }

    public static final JsonAdapter<OSRDError> adapter = Reflection.makeJsonAdapterFromSubtypes(
            OSRDError.class, "type", List.of(ErrorContext.adapter), "osrdErrorType");
}
