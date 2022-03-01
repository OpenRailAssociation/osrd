package fr.sncf.osrd.railjson.schema.common;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

@SuppressFBWarnings("UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD")
public final class RJSTrackLocation {
    @Json(name = "track_section")
    public ID<RJSTrackSection> trackSection;
    public double offset;
}
