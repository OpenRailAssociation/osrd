package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCatenary;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDeadSection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.railjson.schema.geom.LineString;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class RJSInfra {
    /** Moshi adapter used to serialize and deserialize RJSInfra */
    public static final JsonAdapter<RJSInfra> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(LineString.adapter)
            .build()
            .adapter(RJSInfra.class);

    public static final transient String CURRENT_VERSION = "3.3.0";

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

    /** The list of routes */
    public Collection<RJSRoute> routes;

    /** The map of switch types */
    @Json(name = "switch_types")
    public List<RJSSwitchType> switchTypes;

    public List<RJSSignal> signals;

    @Json(name = "buffer_stops")
    public List<RJSBufferStop> bufferStops;

    public List<RJSTrainDetector> detectors;

    @Json(name = "speed_sections")
    public List<RJSSpeedSection> speedSections;

    public List<RJSCatenary> catenaries;

    @Json(name = "dead_sections")
    public List<RJSDeadSection> deadSections;

    /** Create a new serialized RailJSON file */
    public RJSInfra(
            Collection<RJSTrackSection> trackSections,
            Collection<RJSRoute> routes,
            List<RJSSignal> signals,
            List<RJSBufferStop> bufferStops,
            List<RJSTrainDetector> detectors
    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = new ArrayList<>();
        this.switches = new ArrayList<>();
        this.operationalPoints = new ArrayList<>();
        this.routes = routes;
        this.switchTypes = new ArrayList<>();
        this.signals = signals;
        this.bufferStops = bufferStops;
        this.detectors = detectors;
        this.speedSections = new ArrayList<>();
        this.catenaries = new ArrayList<>();
        this.deadSections = new ArrayList<>();
    }
}
