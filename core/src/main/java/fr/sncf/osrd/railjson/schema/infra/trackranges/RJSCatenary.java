package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Collection;

@SuppressFBWarnings("UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD")
public class RJSCatenary {
    public int voltage;
    @Json(name = "track_ranges")
    public Collection<RJSApplicableDirectionsTrackRange> trackRanges;
}
