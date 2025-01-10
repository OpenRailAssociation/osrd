package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSElectrification;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSNeutralSection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import java.util.Collection;
import java.util.List;

public class RJSInfra {
    /** Moshi adapter used to serialize and deserialize RJSInfra */
    public static final JsonAdapter<RJSInfra> adapter =
            new Moshi.Builder().add(ID.Adapter.FACTORY).build().adapter(RJSInfra.class);

    public static final transient String CURRENT_VERSION = "3.4.14";

    /** The version of the infra format used */
    public String version;

    /** A simple graph of track sections. */
    @Json(name = "track_sections")
    public Collection<RJSTrackSection> trackSections;

    /** Switches are at the ends of track sections, and link those together. */
    public Collection<RJSSwitch> switches;

    /** The list of all operational points. Finding reverse dependencies is up to the user. */
    @Json(name = "operational_points")
    public Collection<RJSOperationalPoint> operationalPoints;

    /** The list of routes */
    public Collection<RJSRoute> routes;

    /** The map of switch types */
    @Json(name = "extended_switch_types")
    public List<RJSSwitchType> switchTypes;

    public List<RJSSignal> signals;

    @Json(name = "buffer_stops")
    public List<RJSBufferStop> bufferStops;

    public List<RJSTrainDetector> detectors;

    @Json(name = "speed_sections")
    public List<RJSSpeedSection> speedSections;

    public List<RJSElectrification> electrifications;

    @Json(name = "neutral_sections")
    public List<RJSNeutralSection> neutralSections;
}
