package fr.sncf.osrd.reporting.warnings;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.Serial;

public class StrictWarningError extends OSRDError {
    @Serial
    private static final long serialVersionUID = -6160787914977591307L;
    private final Warning warning;
    public static final String osrdErrorType = "strict_warning";

    protected StrictWarningError(Warning warning) {
        super(
                String.format("Warning was reported with strict mode enabled: %s", warning.message),
                ErrorCause.USER
        );
        this.warning = warning;
    }
}
