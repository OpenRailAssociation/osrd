package fr.sncf.osrd.infra.errors;

import java.io.Serial;

public class DiscontinuousRoute extends InvalidInfraError {

    @Serial
    private static final long serialVersionUID = 8332336474561453469L;
    public static final String osrdErrorType = "discontinuous_route";

    public final String routeID;
    public final String previousTrackID;
    public final String nextTrackID;

    /** Constructor */
    public DiscontinuousRoute(String routeID, String previousTrackID, String nextTrackID) {
        super("Route track path isn't contiguous");
        this.routeID = routeID;
        this.previousTrackID = previousTrackID;
        this.nextTrackID = nextTrackID;
    }

    @Override
    public String getMessage() {
        return String.format(
                "Discontinuous route %s (prev edge: %s, next edge: %s)",
                routeID, previousTrackID, nextTrackID
        );
    }
}
