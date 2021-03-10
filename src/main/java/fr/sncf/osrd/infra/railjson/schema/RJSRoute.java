package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;

import java.util.Map;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoute implements Identified {
    public final String id;

    /** List of TVD sections through which the route transits */
    @Json(name = "tvd_sections")
    public final List<ID<RJSTVDSection>> tvdSections;

    /** List of waypoints that define the route. */
    public final List<ID<RJSRouteWaypoint>> waypoints;

    /** List of the switches and their position through which the route transits */
    @Json(name = "switches_position")
    public final Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition;

    @Json(name = "transit_type")
    public final RJSRoute.TransitType transitType;

    /** Routes are described as a list of waypoints, TVD Sections and Switches in specific positions */
    public RJSRoute(
            String id,
            List<ID<RJSTVDSection>> tvdSections,
            Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition,
            List<ID<RJSRouteWaypoint>> waypoints,
            TransitType transitType
    ) {
        this.id = id;
        this.tvdSections = tvdSections;
        this.switchesPosition = switchesPosition;
        this.waypoints = waypoints;
        this.transitType = transitType;
    }

    @Override
    public String getID() {
        return id;
    }

    public enum State {
        FREE,
        RESERVED,
        OCCUPIED,
        CONFLICT
    }

    public enum TransitType {
        FLEXIBLE,
        RIGID
    }
}
