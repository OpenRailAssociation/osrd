package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint;
import fr.sncf.osrd.railjson.schema.common.ID;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPointPart extends BiDirectionalRJSTrackRange {
    /** The identifier of the operational point this belongs to. */
    public final ID<RJSOperationalPoint> ref;

    public RJSOperationalPointPart(ID<RJSOperationalPoint> ref, double start, double end) {
        super(start, end);
        this.ref = ref;
    }
}
