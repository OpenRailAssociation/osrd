package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.ObjectRef;
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
    public ObjectRef<RJSTrainDetector> linkedDetector;

    public double angle;

    /** Instantiate RJSSignal */
    public RJSSignal(
            String id,
            ObjectRef<RJSTrackSection> track,
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
