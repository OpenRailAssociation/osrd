package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Collection;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoute implements Identified {
    public final String id;

    @Json(name = "tvd_sections")
    public final Collection<ID<RJSTVDSection>> tvdSections;

    @Json(name = "switches_position")
    public final Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition;

    /** Routes are described as a list of waypoints, TVD Sections and Switches in specific positions */
    public RJSRoute(
            String id,
            Collection<ID<RJSTVDSection>> tvdSections,
            Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition
    ) {
        this.id = id;
        this.tvdSections = tvdSections;
        this.switchesPosition = switchesPosition;
    }

    @Override
    public String getID() {
        return id;
    }
}
