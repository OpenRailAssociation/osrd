package fr.sncf.osrd.railjson.parser.exceptions;

public class UnknownRoute extends InvalidSchedule {
    private static final long serialVersionUID = 8037955751356257543L;
    public static final String osrdErrorType = "unknown_route";

    public final String routeID;

    public UnknownRoute(String message, String routeID) {
        super(message);
        this.routeID = routeID;
    }
}
