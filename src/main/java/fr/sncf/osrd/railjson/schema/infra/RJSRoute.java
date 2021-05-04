package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;

import java.util.Map;
import java.util.List;
import java.util.Set;

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

    /** Signal placed just before the route, may be empty if no entry signal */
    @Json(name = "entry_signal")
    public ID<RJSSignal> entrySignal;

    /** Routes are described as a list of waypoints, TVD Sections and Switches in specific positions */
    public RJSRoute(
            String id,
            List<ID<RJSTVDSection>> tvdSections,
            Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition,
            List<ID<RJSRouteWaypoint>> waypoints,
            List<Set<ID<RJSTVDSection>>> releaseGroups,
            ID<RJSSignal> entrySignal
    ) {
        this.id = id;
        this.tvdSections = tvdSections;
        this.switchesPosition = switchesPosition;
        this.waypoints = waypoints;
        this.releaseGroups = releaseGroups;
        this.entrySignal = entrySignal;
    }

    @Override
    public String getID() {
        return id;
    }

    public enum State {
        FREE,
        RESERVED,
        OCCUPIED,
        CONFLICT,
        REQUESTED
    }
}
