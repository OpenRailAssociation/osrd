package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.geom.RJSLineString;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCurve;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;
import java.util.List;
import org.jetbrains.annotations.Nullable;

@SuppressFBWarnings({"UWF_FIELD_NOT_INITIALIZED_IN_CONSTRUCTOR", "UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSTrackSection implements Identified {
    public String id;
    public double length;

    public List<RJSSlope> slopes;
    public List<RJSCurve> curves;

    @Json(name = "loading_gauge_limits")
    public List<RJSLoadingGaugeLimit> loadingGaugeLimits;

    public RJSLineString geo;

    @Nullable
    public TrackExtensions extensions;

    public RJSTrackSection(String id, double length) {
        this.id = id;
        this.length = length;
    }

    @Override
    public String getID() {
        return id;
    }

    /** Track extensions are extra metadata that shouldn't normally be used for simulation, but may help with some heuristic. */
    public static class TrackExtensions {
        @Nullable
        public SNCFExtension sncf;
    }

    public static class SNCFExtension {
        @Nullable
        @Json(name = "line_code")
        public Integer lineCode;

        @Nullable
        @Json(name = "line_name")
        public String lineName;

        @Nullable
        @Json(name = "track_name")
        public String trackName;

        @Nullable
        @Json(name = "track_number")
        public Integer trackNumber;
    }
}
