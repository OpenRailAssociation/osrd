package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSAspect;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalFunction;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;

import java.util.ArrayList;
import java.util.Collection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoot {
    public static final JsonAdapter<RJSRoot> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(new RJSAspect.Adapter())
            .add(RJSSignalFunction.ArgumentRef.Adapter.FACTORY)
            .add(RJSSignalExpr.adapter)
            .add(RJSRouteWaypoint.adapter)
            .build()
            .adapter(RJSRoot.class);

    /** An incremental format version number, which may be used for migrations */
    public final int version = 1;

    /** A simple graph of track sections. */
    @Json(name = "track_sections")
    public final Collection<RJSTrackSection> trackSections;

    @Json(name = "track_section_links")
    public final Collection<RJSTrackSectionLink> trackSectionLinks;

    /** Switches are at the ends of track sections, and link those together. */
    public final Collection<RJSSwitch> switches;

    /**
     * The list of all operational points.
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "operational_points")
    public final Collection<RJSOperationalPoint> operationalPoints;

    /**
     * Track vacancy detection sections
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "tvd_sections")
    public final Collection<RJSTVDSection> tvdSections;

    public final Collection<RJSRoute> routes;

    @Json(name = "speed_sections")
    public final Collection<RJSSpeedSection> speedSections;

    /** The list of all the aspects signals can take */
    public final Collection<RJSAspect> aspects;

    /** The list of function definitions */
    @Json(name = "signal_functions")
    public final Collection<RJSSignalFunction> signalFunctions;

    /** Create a new serialized RailJSON file */
    public RJSRoot(
            Collection<RJSTrackSection> trackSections,
            Collection<RJSTrackSectionLink> trackSectionLinks,
            Collection<RJSSwitch> switches,
            Collection<RJSOperationalPoint> operationalPoints,
            Collection<RJSTVDSection> tvdSections,
            Collection<RJSRoute> routes,
            Collection<RJSSpeedSection> speedSections,
            Collection<RJSAspect> aspects,
            Collection<RJSSignalFunction> signalFunctions
    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = trackSectionLinks;
        this.switches = switches;
        this.operationalPoints = operationalPoints;
        this.tvdSections = tvdSections;
        this.routes = routes;
        this.speedSections = speedSections;
        this.aspects = aspects;
        this.signalFunctions = signalFunctions;
    }

    /**
     * Create an empty RailJSON file
     */
    public RJSRoot() {
        this(
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

