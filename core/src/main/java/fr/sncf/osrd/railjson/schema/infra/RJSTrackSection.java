package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCurve;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCatenarySection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.ArrayList;
import java.util.List;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class RJSTrackSection implements Identified {
    public ApplicableDirection navigability;
    public String id;
    public double length;

    @Json(name = "line_code")
    public int lineCode;
    @Json(name = "line_name")
    public String lineName;
    @Json(name = "track_number")
    public int trackNumber;
    @Json(name = "track_name")
    public String trackName;

    public List<RJSSlope> slopes;
    public List<RJSCurve> curves;

    /** List of speed sections on the track section */
    @Json(name = "speed_sections")
    public List<RJSSpeedSection> speedSections;

    /** List of the catenaries on the track section */
    @Json(name = "catenary_sections")
    public List<RJSCatenarySection> catenarySections;

    public GeoData sch;

    /** Creates a new track section */
    public RJSTrackSection(
            String id,
            double length,
            List<RJSSpeedSection> speedSections,
            List<RJSCatenarySection> catenarySections,
            int lineCode,
            String lineName,
            int trackNumber,
            String trackName,
            ApplicableDirection navigability,
            List<RJSSlope> slopes,
            List<RJSCurve> curves,
            GeoData sch
    ) {
        this.id = id;
        this.length = length;
        this.lineName = lineName;
        this.lineCode = lineCode;
        this.trackNumber = trackNumber;
        this.trackName = trackName;
        this.navigability = navigability;
        this.slopes = slopes;
        this.curves = curves;
        this.speedSections = speedSections;
        this.catenarySections = catenarySections;
        this.sch = sch;
    }

    public RJSTrackSection(
            String id,
            double length
    ) {
        this(id, length, new ArrayList<>(), new ArrayList<>(), 0, "", 0, "",
                ApplicableDirection.BOTH, new ArrayList<>(), new ArrayList<>(), new GeoData());
    }

    @Override
    public String getID() {
        return id;
    }

    public RJSTrackEndpoint beginEndpoint() {
        return new RJSTrackEndpoint(new RJSObjectRef<>(ID.from(this), "track_section"), EdgeEndpoint.BEGIN);
    }

    public RJSTrackEndpoint endEndpoint() {
        return new RJSTrackEndpoint(new RJSObjectRef<>(ID.from(this), "track_section"), EdgeEndpoint.END);
    }

}
