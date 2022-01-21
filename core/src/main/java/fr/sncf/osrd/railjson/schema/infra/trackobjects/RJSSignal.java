package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.List;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    public EdgeDirection direction;

    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance")
    public double sightDistance;

    /** The behavior of the signal */
    public RJSRSExpr expr;

    /** Detector linked with the signal, may be empty if the signal doesn't protect a route */
    @Json(name = "linked_detector")
    public RJSObjectRef<RJSTrainDetector> linkedDetector;

    /** List of possible aspects on the signal (optional) */
    public List<String> aspects;

    @Override
    public String getID() {
        return id;
    }
}
