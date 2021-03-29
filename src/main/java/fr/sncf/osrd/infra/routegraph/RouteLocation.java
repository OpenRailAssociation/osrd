package fr.sncf.osrd.infra.routegraph;

public class RouteLocation {
    public final Route route;
    public final double offset;

    public RouteLocation(Route route, double offset) {
        this.route = route;
        this.offset = offset;
    }
}
