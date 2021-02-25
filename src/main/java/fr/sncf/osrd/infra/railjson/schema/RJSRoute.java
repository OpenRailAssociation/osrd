package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Collection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoute implements Identified {
    public final String id;

    @Json(name = "tvd_sections")
    public final Collection<ID<RJSTVDSection>> tvdSections;

    public RJSRoute(String id, Collection<ID<RJSTVDSection>> tvdSections) {
        this.id = id;
        this.tvdSections = tvdSections;
    }

    @Override
    public String getID() {
        return id;
    }
}
