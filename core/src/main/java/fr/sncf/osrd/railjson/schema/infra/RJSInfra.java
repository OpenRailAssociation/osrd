package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSFunction;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspect;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspectConstraint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class RJSInfra {
    /** Moshi adapter used to serialize and deserialize RJSInfra */
    public static final JsonAdapter<RJSInfra> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRSExpr.adapter)
            .add(RJSAspectConstraint.adapter)
            .build()
            .adapter(RJSInfra.class);

    public static final transient String CURRENT_VERSION = "2.0.0";

    /** The version of the infra format used */
    public String version;

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

    /** The list of all the aspects signals can take */
    public Collection<RJSAspect> aspects;

    /** The list of function definitions */
    @Json(name = "script_functions")
    public List<RJSRSFunction> scriptFunctions;

    /** The map of switch types */
    @Json(name = "switch_types")
    public List<RJSSwitchType> switchTypes;

    public List<RJSSignal> signals;

    @Json(name = "buffer_stops")
    public List<RJSBufferStop> bufferStops;

    public List<RJSTrainDetector> detectors;

    /** Create a new serialized RailJSON file */
    public RJSInfra(
            Collection<RJSTrackSection> trackSections,
            Collection<RJSTrackSectionLink> trackSectionLinks,
            Collection<RJSSwitch> switches,
            Collection<RJSOperationalPoint> operationalPoints,
            Collection<RJSTVDSection> tvdSections,
            Collection<RJSRoute> routes,
            Collection<RJSAspect> aspects,
            List<RJSRSFunction> signalFunctions,
            List<RJSSwitchType> switchTypes,
            List<RJSSignal> signals,
            List<RJSBufferStop> bufferStops,
            List<RJSTrainDetector> detectors

    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = trackSectionLinks;
        this.switches = switches;
        this.operationalPoints = operationalPoints;
        this.tvdSections = tvdSections;
        this.routes = routes;
        this.aspects = aspects;
        this.scriptFunctions = signalFunctions;
        this.switchTypes = switchTypes;
        this.signals = signals;
        this.bufferStops = bufferStops;
        this.detectors = detectors;
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
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>()
        );
    }
}