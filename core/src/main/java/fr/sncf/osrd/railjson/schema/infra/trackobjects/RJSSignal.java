package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    @Json(name = "direction")
    public EdgeDirection direction;

    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance")
    public double sightDistance;

    /** The behavior of the signal */
    public RJSRSExpr expr;

    /** Detector linked with the signal, may be empty if the signal doesn't protect a route */
    @Json(name = "linked_detector")
    public RJSObjectRef<RJSTrainDetector> linkedDetector;

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public double angle;

    /** Instantiate RJSSignal */
    public RJSSignal(
            String id,
            RJSObjectRef<RJSTrackSection> track,
            EdgeDirection direction,
            double position,
            double sightDistance,
            RJSRSExpr expr,
            double angle
    ) {
        super(track, position);
        this.id = id;
        this.sightDistance = sightDistance;
        this.expr = expr;
        this.direction = direction;
        this.angle = angle;
    }

    @Override
    public String getID() {
        return id;
    }
}
