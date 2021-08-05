package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSFunction;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspect;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspectConstraint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCurve;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class RJSInfra {
    /** Moshi adapter used to serialize and deserialize RJSInfra */
    public static final JsonAdapter<RJSInfra> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRSExpr.adapter)
            .add(RJSRouteWaypoint.adapter)
            .add(RJSAspectConstraint.adapter)
            .build()
            .adapter(RJSInfra.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A simple graph of track sections. */
    @Json(name = "track_sections")
    public Collection<RJSTrackSection> trackSections;

    @Json(name = "track_section_links")
    public Collection<RJSTrackSectionLink> trackSectionLinks;

    /** Switches are at the ends of track sections, and link those together. */
    public Collection<RJSSwitch> switches;

    /**
     * The list of all operational points.
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "operational_points")
    public Collection<RJSOperationalPoint> operationalPoints;

    /**
     * Track vacancy detection sections
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "tvd_sections")
    public Collection<RJSTVDSection> tvdSections;

    /** The list of routes */
    public Collection<RJSRoute> routes;

    /** The list of speed sections */
    @Json(name = "speed_sections")
    public Collection<RJSSpeedSection> speedSections;

    /** The list of all the aspects signals can take */
    public Collection<RJSAspect> aspects;

    /** The list of function definitions */
    @Json(name = "script_functions")
    public List<RJSRSFunction> scriptFunctions;

    /** The map of switch types */
    @Json(name = "switch_types")
    public Map<String, RJSSwitchType> switchTypes;

    /** Create a new serialized RailJSON file */
    public RJSInfra(
            Collection<RJSTrackSection> trackSections,
            Collection<RJSTrackSectionLink> trackSectionLinks,
            Collection<RJSSwitch> switches,
            Collection<RJSOperationalPoint> operationalPoints,
            Collection<RJSTVDSection> tvdSections,
            Collection<RJSRoute> routes,
            Collection<RJSSpeedSection> speedSections,
            Collection<RJSAspect> aspects,
            List<RJSRSFunction> signalFunctions,
            Map<String, RJSSwitchType> switchTypes
    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = trackSectionLinks;
        this.switches = switches;
        this.operationalPoints = operationalPoints;
        this.tvdSections = tvdSections;
        this.routes = routes;
        this.speedSections = speedSections;
        this.aspects = aspects;
        this.scriptFunctions = signalFunctions;
        this.switchTypes = switchTypes;
    }

    /**
     * Create an empty RailJSON file
     */
    public RJSInfra() {
        this(
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new HashMap<>()
        );
    }
}