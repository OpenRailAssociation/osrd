package fr.sncf.osrd.railjson.schema.infra.trackranges;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSDeadSection {
    @Json(name = "track_ranges")
    public List<RJSDirectionalTrackRange> trackRanges;

    @Json(name = "backside_pantograph_track_ranges")
    public List<RJSDirectionalTrackRange> backsidePantographTrackRanges;

    @Json(name = "is_pantograph_drop_zone")
    public boolean isPantographDropZone;
}
