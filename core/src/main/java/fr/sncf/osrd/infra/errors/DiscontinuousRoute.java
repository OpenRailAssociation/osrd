package fr.sncf.osrd.infra.errors;

import java.io.Serial;

public class DiscontinuousRoute extends InvalidInfraError {

    @Serial
    private static final long serialVersionUID = 8332336474561453469L;
    public static final String osrdErrorType = "discontinuous_route";

    public final String routeID;

    /** Constructor */
    public DiscontinuousRoute(String routeID) {
        super("Route track path isn't contiguous");
        this.routeID = routeID;
    }

    @Override
    public String getMessage() {
        return String.format("Discontinuous route %s", routeID);
    }
}
