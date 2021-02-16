package fr.sncf.osrd.infra.parsing.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.ArrayList;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RailJSONRoot {
    /** A simple graph of track sections. */
    @Json(name = "track_sections")
    public final List<TrackSection> trackSections;

    @Json(name = "track_section_links")
    public final List<TrackSectionLink> trackSectionLinks;

    /** Switches are at the ends of track sections, and link those together. */
    public final List<Switch> switches;

    /**
     * The list of all operational points.
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "operational_points")
    public final List<OperationalPoint> operationalPoints;

    /**
     * Track vacancy detection sections
     * Finding reverse dependencies is up to the user.
     */
    @Json(name = "tvd_sections")
    public final List<TVDSection> tvdSections;

    @Json(name = "speed_sections")
    public final List<SpeedSection> speedSections;

    /**
     * Create a new serialized RailJSON file
     * @param trackSections the list of track sections
     * @param trackSectionLinks the list of links between track section ends
     * @param switches the list of switches
     * @param operationalPoints the list of operational points
     * @param tvdSections the list of train detection sections
     * @param speedSections the list of speed sections
     */
    public RailJSONRoot(
            List<TrackSection> trackSections,
            List<TrackSectionLink> trackSectionLinks,
            List<Switch> switches,
            List<OperationalPoint> operationalPoints,
            List<TVDSection> tvdSections,
            List<SpeedSection> speedSections
    ) {
        this.trackSections = trackSections;
        this.trackSectionLinks = trackSectionLinks;
        this.switches = switches;
        this.operationalPoints = operationalPoints;
        this.tvdSections = tvdSections;
        this.speedSections = speedSections;
    }

    /**
     * Create an empty RailJSON file
     */
    public RailJSONRoot() {
        this(
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>()
        );
    }
}
