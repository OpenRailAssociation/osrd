package fr.sncf.osrd.infra.errors;

import java.io.Serial;

public class MissingDetectorsRoute extends InvalidInfraError {

    @Serial
    private static final long serialVersionUID = 8332336474561453469L;
    public static final String osrdErrorType = "invalid_path_route";

    public final String routeID;
    public final int nbDetectors;

    /** Constructor */
    public MissingDetectorsRoute(String routeID, int nbDetectors) {
        super("Route doesn't contains enough detectors");
        this.routeID = routeID;
        this.nbDetectors = nbDetectors;
    }

    @Override
    public String getMessage() {
        return String.format(
                "Missing detectors on route %s (get %d expected at least 2)",
                routeID, nbDetectors
        );
    }
}
