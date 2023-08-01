package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSNeutralSection {
    @Json(name = "track_ranges")
    public List<RJSDirectionalTrackRange> trackRanges;

    @Json(name = "lower_pantograph")
    public boolean lowerPantograph;
}
