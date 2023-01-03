package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSDirectionalTrackRange extends RJSTrackRange {
    public EdgeDirection direction;

    /**
     * Constructor
     */
    public RJSDirectionalTrackRange(EdgeDirection direction, String track, double begin, double end) {
        super(track, begin, end);
        this.direction = direction;
    }
}
