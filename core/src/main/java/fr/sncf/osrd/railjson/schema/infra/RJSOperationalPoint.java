package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD", "UUF_UNUSED_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPoint implements Identified {
    public String name;
    public int ci;
    public String ch;

    @Json(name = "ch_short_label")
    public String chShortLabel;

    @Json(name = "ch_long_label")
    public String chLongLabel;

    public List<RJSOperationalPointPart> parts;

    public RJSOperationalPoint(String name, List<RJSOperationalPointPart> parts) {
        this.name = name;
        this.parts = parts;
    }

    @Override
    public String getID() {
        return name;
    }
}
