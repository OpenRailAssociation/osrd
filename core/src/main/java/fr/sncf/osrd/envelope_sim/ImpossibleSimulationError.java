package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.reporting.exceptions.OSRDError;
import java.io.Serial;

public class ImpossibleSimulationError extends OSRDError {

    @Serial
    private static final long serialVersionUID = -5665109729224986723L;
    public static final String osrdErrorType = "impossible_simulation";

    public ImpossibleSimulationError() {
        super("The requested train couldn't reach its destination", ErrorCause.USER);
    }
}
