package fr.sncf.osrd.reporting.warnings;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.Serial;
import java.util.List;

@SuppressWarnings("serial") // Removes the warning about List not being serializable (moshi doesn't support ArrayList)
public class DiagnosticError extends OSRDError {
    @Serial
    private static final long serialVersionUID = -6160787914977591307L;
    private final List<Warning> warnings;
    private final List<OSRDError> errors;
    public static final String osrdErrorType = "diagnostic";

    protected DiagnosticError(DiagnosticRecorder recorder) {
        super("A running diagnostic contains errors", ErrorCause.USER);
        this.warnings = recorder.getWarnings();
        this.errors = recorder.getErrors();
    }
}
