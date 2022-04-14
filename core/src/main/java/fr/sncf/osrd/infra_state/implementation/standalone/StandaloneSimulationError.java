package fr.sncf.osrd.infra_state.implementation.standalone;

import fr.sncf.osrd.exceptions.OSRDError;
import java.io.Serial;

public class StandaloneSimulationError extends OSRDError {
    @Serial
    private static final long serialVersionUID = -2966725866296617520L;
    public static final String osrdErrorType = "standalone_simulation";

    protected StandaloneSimulationError(String message) {
        super(message, ErrorCause.INTERNAL);
    }
}
