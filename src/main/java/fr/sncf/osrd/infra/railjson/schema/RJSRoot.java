package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSAspect;

import java.util.ArrayList;
import java.util.Collection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoot {
    public static final JsonAdapter<RJSRoot> adapter = new Moshi
            .Builder()
            .add(new ID.Adapter())
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

    @Json(name = "speed_sections")
    public final Collection<RJSSpeedSection> speedSections;

    /** The list of all the aspects signals can take */
    public final Collection<RJSAspect> aspects;

    /**
     * Create a new serialized RailJSON file
     * @param trackSections the list of track sections
     * @param trackSectionLinks the list of links between track section ends
     * @param switches the list of switches
     * @param operationalPoints the list of operational points
     * @param tvdSections the list of train detection sections
     * @param speedSections the list of speed sections
     * @param aspects the list of valid signal aspects
     */
    public RJSRoot(
            Collection<RJSTrackSection> trackSections,
            Collection<RJSTrackSectionLink> trackSectionLinks,
            Collection<RJSSwitch> switches,
            Collection<RJSOperationalPoint> operationalPoints,
            Collection<RJSTVDSection> tvdSections,
            Collection<RJSSpeedSection> speedSections,
            Collection<RJSAspect> aspects
    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = trackSectionLinks;
        this.switches = switches;
        this.operationalPoints = operationalPoints;
        this.tvdSections = tvdSections;
        this.speedSections = speedSections;
        this.aspects = aspects;
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
                new ArrayList<>()
        );
    }
}

