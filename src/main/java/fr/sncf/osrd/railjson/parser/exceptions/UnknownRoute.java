package fr.sncf.osrd.railjson.parser.exceptions;

public class UnknownRoute extends InvalidSchedule {
    static final long serialVersionUID = -986192323545717567L;

    public final String routeID;

    public UnknownRoute(String message, String routeID) {
        super(message);
        this.routeID = routeID;
    }
}
