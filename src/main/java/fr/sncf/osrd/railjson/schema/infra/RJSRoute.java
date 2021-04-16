package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.utils.SortedArraySet;

import java.util.Map;
import java.util.List;
import java.util.Set;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoute implements Identified {
    public String id;

    /** List of TVD sections through which the route transits */
    @Json(name = "tvd_sections")
    public List<ID<RJSTVDSection>> tvdSections;

    /** List of waypoints that define the route. */
    public List<ID<RJSRouteWaypoint>> waypoints;

    /** List of the switches and their position through which the route transits */
    @Json(name = "switches_position")
    public Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition;

    @Json(name = "release_groups")
    public List<Set<ID<RJSTVDSection>>> releaseGroups;

    /** Routes are described as a list of waypoints, TVD Sections and Switches in specific positions */
    public RJSRoute(
            String id,
            List<ID<RJSTVDSection>> tvdSections,
            Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition,
            List<ID<RJSRouteWaypoint>> waypoints,
            List<Set<ID<RJSTVDSection>>> releaseGroups
    ) {
        this.id = id;
        this.tvdSections = tvdSections;
        this.switchesPosition = switchesPosition;
        this.waypoints = waypoints;
        this.releaseGroups = releaseGroups;
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
}
