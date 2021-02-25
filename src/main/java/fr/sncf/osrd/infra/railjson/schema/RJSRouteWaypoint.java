package fr.sncf.osrd.infra.railjson.schema;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrainDetector;

/**
 * The RailJSON representation look like that:
 * <pre>
 * {@code
 * {"type": "buffer_stop", "id": "XXX"}
 * }
 * </pre>
 */
public abstract class RJSRouteWaypoint {
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