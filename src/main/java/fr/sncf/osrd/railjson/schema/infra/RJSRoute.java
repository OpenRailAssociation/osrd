package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class RJSRoute implements Identified {
    public String id;

    /** List of the switches and their position through which the route transits */
    @Json(name = "switches_group")
    public Map<ID<RJSSwitch>, String> switchesGroup;

    @Json(name = "release_groups")
    public List<Set<ID<RJSTVDSection>>> releaseGroups;

    /** Waypoint placed just before the route, either a buffer stop or a detector attached to a signal */
    @Json(name = "entry_point")
    public ID<RJSRouteWaypoint> entryPoint;

    /** The last waypoint of the route, either a buffer stop or a detector */
    @Json(name = "exit_point")
    public ID<RJSRouteWaypoint> exitPoint;

    /** The edge direction at the first waypoint */
    @Json(name = "entry_direction")
    public EdgeDirection entryDirection;

    /** Routes are described as a list of TVD Sections, Switches in specific positions, and an entry point */
    public RJSRoute(
            String id,
            Map<ID<RJSSwitch>, String> switchesGroup,
            List<Set<ID<RJSTVDSection>>> releaseGroups,
            ID<RJSRouteWaypoint> entryPoint,
            ID<RJSRouteWaypoint> exitPoint,
            EdgeDirection entryDirection
    ) {
        this.id = id;
        this.switchesGroup = switchesGroup;
        this.releaseGroups = releaseGroups;
        this.entryPoint = entryPoint;
        this.exitPoint = exitPoint;
        this.entryDirection = entryDirection;
    }

    @Override
    public String getID() {
        return id;
    }

    public enum State {
        FREE,
        REQUESTED,
        RESERVED,
        OCCUPIED,
        CBTC_REQUESTED,
        CBTC_RESERVED,
        CBTC_OCCUPIED,
        CONFLICT
    }
}
