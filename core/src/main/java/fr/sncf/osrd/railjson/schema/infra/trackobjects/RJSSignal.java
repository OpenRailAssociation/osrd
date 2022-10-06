package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    public EdgeDirection direction;

    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance")
    public double sightDistance;

    /** Detector linked with the signal, may be empty if the signal doesn't protect a route */
    @Json(name = "linked_detector")
    public String linkedDetector;

    /** Constructor */
    public RJSSignal(
            String id,
            EdgeDirection direction,
            double sightDistance,
            String linkedDetector
    ) {
        this.id = id;
        this.direction = direction;
        this.sightDistance = sightDistance;
        this.linkedDetector = linkedDetector;
    }

    @Override
    public String getID() {
        return id;
    }
}
