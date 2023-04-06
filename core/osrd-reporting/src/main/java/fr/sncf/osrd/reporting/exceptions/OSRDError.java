package fr.sncf.osrd.reporting.exceptions;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.*;
import fr.sncf.osrd.reporting.ErrorContext;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;
import fr.sncf.osrd.reporting.warnings.Warning;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.Serial;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Base exception class for the OSRD project.
 *
 * <p>When an exception is caught, context can be added to it. A context stack will be included in the error report.
 * Example:
 * <pre>
 * {@code
 * try {
 *     train.thingThatMayThrow();
 * } catch (OSRDError e) {
 *     throw e.withStackTrace(new ErrorContext.Train(train.id));
 * }
 * }
 * </pre>
 */
public final class OSRDError extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1197516372515951853L;

    public final String type;
    public final String message;
    public Map<String, Object> context = new HashMap<>();

    public final transient ErrorType osrdErrorType;
    public final transient ErrorCause cause;

    /**
     * Constructs a new OSRDError with the specified error type.
     *
     * @param errorType the error type
     */
    public OSRDError(ErrorType errorType) {
        this.type = errorType.type;
        this.message = errorType.message;
        this.cause = errorType.cause;
        this.osrdErrorType = errorType;
    }

    /**
     * Constructs a new OSRDError with the specified error type and underlying cause.
     *
     * @param errorType the error type
     * @param e         the underlying cause of the error
     */
    public OSRDError(ErrorType errorType, Throwable e) {
        super(e);
        this.type = errorType.type;
        this.message = errorType.message;
        this.cause = errorType.cause;
        this.osrdErrorType = errorType;
    }

    /**
     * Creates a new OSRDError for a diagnostic error.
     *
     * @param diagnostic the diagnostic recorder
     * @return a new OSRDError instance
     */
    public static OSRDError newDiagnosticError(DiagnosticRecorder diagnostic) {
        var error = new OSRDError(ErrorType.DiagnosticError);
        error.context.put("diagnostic_warnings", diagnostic.getWarnings());
        error.context.put("diagnostic_errors", diagnostic.getErrors());
        return error;
    }

    /**
     * Creates a new OSRDError for a strict warning error.
     *
     * @param warning the warning
     * @return a new OSRDError instance
     */
    public static OSRDError newStrictWarningError(Warning warning) {
        var error = new OSRDError(ErrorType.StrictWarningError);
        error.context.put("warning", warning);
        return error;
    }

    /**
     * Creates a new OSRDError for an assertion error.
     *
     * @param assertionError the assertion error
     * @return a new OSRDError instance
     */
    public static OSRDError newAssertionWrapper(AssertionError assertionError) {
        var error = new OSRDError(ErrorType.AssertionError);
        error.context.put("message", assertionError.getMessage());
        error.context.put("stack_trace", convertStackTrace(assertionError.getStackTrace()));
        return error;
    }

    /**
     * Creates a new OSRDError for an infrastructure loading error.
     *
     * @param errorType       the error type
     * @param sourceOperation the source operation
     * @return a new OSRDError instance
     */
    public static OSRDError newInfraLoadingError(ErrorType errorType, Object sourceOperation) {
        var error = new OSRDError(errorType);
        error.context.put("source_operation", sourceOperation);
        return error;
    }

    /**
     * Creates a new OSRDError for an infrastructure loading error with an underlying cause.
     *
     * @param errorType       the error type
     * @param sourceOperation the source operation
     * @param e               the underlying cause of the error
     * @return a new OSRDError instance
     */
    public static OSRDError newInfraLoadingError(ErrorType errorType, Object sourceOperation, Throwable e) {
        var error = new OSRDError(errorType, e);
        error.context.put("source_operation", sourceOperation);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid rolling stock error with expected and actual rolling stock versions.
     *
     * @param errorType                  the error type
     * @param expectedRollingStockVersion the expected rolling stock version
     * @param actualRollingStockVersion   the actual rolling stock version
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidRollingStockError(
            ErrorType errorType,
            String expectedRollingStockVersion,
            String actualRollingStockVersion
    ) {
        var error = new OSRDError(errorType);
        error.context.put("expected_rolling_stock_version", expectedRollingStockVersion);
        error.context.put("got_rolling_stock_version", actualRollingStockVersion);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid rolling stock error with a default mode.
     *
     * @param errorType   the error type
     * @param defaultMode the default mode
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidRollingStockError(
            ErrorType errorType,
            String defaultMode
    ) {
        var error = new OSRDError(errorType);
        error.context.put("default_mode", defaultMode);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid rolling stock field error.
     *
     * @param fieldKey          the field key
     * @param fieldDescription  the field description
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidRollingStockFieldError(
            String fieldKey,
            String fieldDescription
    ) {
        var error = new OSRDError(ErrorType.InvalidRollingStockField);
        error.context.put("field_key", fieldKey);
        error.context.put("field_description", fieldDescription);
        return error;
    }

    /**
     * Creates a new OSRDError for a missing rolling stock field error.
     *
     * @param fieldKey the field key
     * @return a new OSRDError instance
     */
    public static OSRDError newMissingRollingStockFieldError(
            String fieldKey
    ) {
        var error = new OSRDError(ErrorType.MissingRollingStockField);
        error.context.put("field_key", fieldKey);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid schedule error with a track section.
     *
     * @param errorType     the error type
     * @param trackSection  the track section associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidScheduleError(
            ErrorType errorType,
            String trackSection
    ) {
        var error = new OSRDError(errorType);
        error.context.put("track_section", trackSection);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid schedule error with a route and route signaling type.
     *
     * @param errorType           the error type
     * @param route               the route associated with the error
     * @param routeSignalingType  the route signaling type
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidScheduleError(
            ErrorType errorType,
            String route,
            String routeSignalingType
    ) {
        var error = new OSRDError(errorType);
        error.context.put("route", route);
        error.context.put("route_signaling_type", routeSignalingType);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid track range error with an offset.
     *
     * @param offset the track section offset associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidTrackRangeError(
            double offset
    ) {
        var error = new OSRDError(ErrorType.InvalidTrackRangeInvalidTrackSectionOffset);
        error.context.put("offset", offset);
        return error;
    }

    /**
     * Creates a new OSRDError for an invalid path error with previous and current detectors.
     *
     * @param previousDetector the previous detector
     * @param detector         the current detector
     * @return a new OSRDError instance
     */
    public static OSRDError newInvalidPathError(
            Object previousDetector,
            Object detector
    ) {
        var error = new OSRDError(ErrorType.InvalidPathError);
        error.context.put("previous_detector", previousDetector);
        error.context.put("detector", detector);
        return error;
    }

    /**
     * Creates a new OSRDError for an unknown rolling stock error with a rolling stock ID.
     *
     * @param rollingStockID the rolling stock ID associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newUnknownRollingStockError(
            String rollingStockID
    ) {
        var error = new OSRDError(ErrorType.UnknownRollingStock);
        error.context.put("rolling_stock_id", rollingStockID);
        return error;
    }

    /**
     * Creates a new OSRDError for an unknown track section error with a track section ID.
     *
     * @param trackSectionID the track section ID associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newUnknownTrackSectionError(
            String trackSectionID
    ) {
        var error = new OSRDError(ErrorType.UnknownTrackSection);
        error.context.put("track_section_id", trackSectionID);
        return error;
    }

    /**
     * Creates a new OSRDError for an aspect error with an aspect value.
     *
     * @param aspect the aspect value associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newAspectError(
            String aspect
    ) {
        var error = new OSRDError(ErrorType.UnknownAspect);
        error.context.put("aspect", aspect);
        return error;
    }

    /**
     * Creates a new OSRDError for an envelope error with an index, stop position, and path length.
     *
     * @param index        the envelope stop index associated with the error
     * @param stopPosition the stop position associated with the error
     * @param pathLength   the path length associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newEnvelopeError(
            int index,
            double stopPosition,
            double pathLength
    ) {
        var error = new OSRDError(ErrorType.EnvelopeStopIndexOutOfBounds);
        error.context.put("index", index);
        error.context.put("stop_position", stopPosition);
        error.context.put("path_length", pathLength);
        return error;
    }

    /**
     * Creates a new OSRDError for a signaling error with a signaling system value.
     *
     * @param sigSystem the signaling system value associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newSignalingError(
            String sigSystem
    ) {
        var error = new OSRDError(ErrorType.SignalingError);
        error.context.put("sigSystem", sigSystem);
        return error;
    }

    /**
     * Creates a new OSRDError for a signaling schema invalid field error with a field value and detail.
     *
     * @param fieldValue the field value associated with the error
     * @param detail     the error detail
     * @return a new OSRDError instance
     */
    public static OSRDError newSigSchemaInvalidFieldError(
            Object fieldValue,
            String detail
    ) {
        var error = new OSRDError(ErrorType.SigSchemaInvalidFieldError);
        error.context.put("field_value", fieldValue);
        error.context.put("detail", detail);
        return error;
    }

    /**
     * Creates a new OSRDError for a signaling schema invalid field error with a field name and detail.
     *
     * @param fieldName the field name associated with the error
     * @param detail    the error detail
     * @return a new OSRDError instance
     */
    public static OSRDError newSigSchemaInvalidFieldError(
            String fieldName,
            String detail
    ) {
        var error = new OSRDError(ErrorType.SigSchemaInvalidFieldError);
        error.context.put("field_name", fieldName);
        error.context.put("detail", detail);
        return error;
    }

    /**
     * Creates a new OSRDError for a signaling schema unknown field error with a field name.
     *
     * @param fieldName the field name associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newSigSchemaUnknownFieldError(
            String fieldName
    ) {
        var error = new OSRDError(ErrorType.SigSchemaUnknownFieldError);
        error.context.put("field_name", fieldName);
        return error;
    }

    /**
     * Creates a new OSRDError for an unexpected reservation status error with a time description.
     *
     * @param when the time description associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newUnexpectedReservationStatusError(
            String when
    ) {
        var error = new OSRDError(ErrorType.UnexpectedReservationStatus);
        error.context.put("when", when);
        return error;
    }

    /**
     * Creates a new OSRDError for an unexpected reservation status error with expected and received values.
     *
     * @param expected the expected value associated with the error
     * @param got      the received value associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newUnexpectedReservationStatusError(
            Object expected,
            Object got
    ) {
        var error = new OSRDError(ErrorType.UnexpectedReservationStatus);
        error.context.put("expected", expected);
        error.context.put("got", got);
        return error;
    }

    /**
     * Creates a new OSRDError for an incompatible zone requirements error with current and new requirements.
     *
     * @param currentRequirements the current requirements associated with the error
     * @param newRequirements     the new requirements associated with the error
     * @return a new OSRDError instance
     */
    public static OSRDError newIncompatibleZoneRequirementsError(
            Object currentRequirements,
            Object newRequirements
    ) {
        var error = new OSRDError(ErrorType.IncompatibleZoneRequirements);
        error.context.put("current_requirement", currentRequirements);
        error.context.put("new_requirement", newRequirements);
        return error;
    }

    /**
     * Returns the error message.
     *
     * @return the error message
     */
    @Override
    public String getMessage() {
        return message;
    }

    /**
     * The JSON adapter for serializing and deserializing OSRDError instances.
     */
    public static final JsonAdapter<OSRDError> adapter;

    static {
        Moshi moshi = new Moshi.Builder().build();
        adapter = moshi.adapter(OSRDError.class);
    }

    /**
     * `OSRDError`s are to be Serialized, but never deserialized, as it’s only used in api responses.
     * The deserialization should not be used.
     */
    @Serial
    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
        throw new RuntimeException("Deserialization isn't supported for OSRDError");
    }

    /**
     * Adds a stack trace to the exception.
     *
     * @param errorContext the error context to add
     * @return the updated OSRDError instance with the added stack trace
     */
    public OSRDError withStackTrace(ErrorContext errorContext) {
        if (context.get("trace") instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> trace = (List<Object>) context.get("trace");
            trace.add(errorContext);
        } else {
            context.put("trace", new ArrayList<>(List.of(errorContext)));
        }
        return this;
    }

    /**
     * Converts a stack trace array to a list of strings.
     *
     * @param stackTrace the stack trace array
     * @return a list of strings representing the stack trace
     */
    private static List<String> convertStackTrace(StackTraceElement[] stackTrace) {
        // A StackTraceElement can't be serialized as it is, we convert it to a list of strings
        return Arrays.stream(stackTrace)
                .map(e -> String.format("%s:%d", e.getFileName(), e.getLineNumber()))
                .collect(Collectors.toList());
    }
}
