package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrainDetector;

import java.util.Collection;
import java.util.Map;
import java.util.List;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSRoute implements Identified {
    public final String id;

    @Json(name = "tvd_sections")
    public final List<ID<RJSTVDSection>> tvdSections;

    public final List<RJSRouteWaypoint> waypoints;

    @Json(name = "switches_position")
    public final Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition;

    /** Routes are described as a list of waypoints, TVD Sections and Switches in specific positions */
    public RJSRoute(
            String id,
            List<ID<RJSTVDSection>> tvdSections,
            Map<ID<RJSSwitch>, RJSSwitch.Position> switchesPosition,
            List<RJSRouteWaypoint> waypoints
    ) {
        this.id = id;
        this.tvdSections = tvdSections;
        this.switchesPosition = switchesPosition;
        this.waypoints = waypoints;
    }

    @Override
    public String getID() {
        return id;
    }

    /**
     * The RailJSON representation look like that:
     * <pre>
     * {@code
     * {"type": "buffer_stop", "id": "XXX"}
     * }
     * </pre>
     */
    public abstract static class RJSRouteWaypoint {
        public static final PolymorphicJsonAdapterFactory<RJSRouteWaypoint> adapter =
                PolymorphicJsonAdapterFactory.of(RJSRouteWaypoint.class, "type")
                        .withSubtype(Detector.class, "detector")
                        .withSubtype(BufferStop.class, "buffer_stop");

        public static final class Detector extends RJSRouteWaypoint {
            public final ID<RJSTrainDetector> id;

            public Detector(ID<RJSTrainDetector> id) {
                this.id = id;
            }
        }

        public static final class BufferStop extends RJSRouteWaypoint {
            public final ID<RJSBufferStop> id;

            public BufferStop(ID<RJSBufferStop> id) {
                this.id = id;
            }
        }
    }
}
