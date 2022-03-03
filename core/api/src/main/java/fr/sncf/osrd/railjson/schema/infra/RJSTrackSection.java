package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSEdgeEndpoint;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCurve;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import java.util.List;

@SuppressFBWarnings({"UWF_FIELD_NOT_INITIALIZED_IN_CONSTRUCTOR", "UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSection implements Identified {
    public String id;
    public double length;

    public List<RJSSlope> slopes;
    public List<RJSCurve> curves;

    /** List of speed sections on the track section */
    @Json(name = "speed_sections")
    public List<RJSSpeedSection> speedSections;

    public GeoData sch;

    @Override
    public String getID() {
        return id;
    }

    public RJSTrackEndpoint beginEndpoint() {
        return new RJSTrackEndpoint(new RJSObjectRef<>(ID.from(this), "TrackSection"), RJSEdgeEndpoint.BEGIN);
    }

    public RJSTrackEndpoint endEndpoint() {
        return new RJSTrackEndpoint(new RJSObjectRef<>(ID.from(this), "TrackSection"), RJSEdgeEndpoint.END);
    }

}
