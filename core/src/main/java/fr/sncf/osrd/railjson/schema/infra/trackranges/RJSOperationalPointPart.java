package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.BiDirectionalRJSTrackObject;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPointPart extends BiDirectionalRJSTrackObject {
    /** The identifier of the operational point this belongs to. */
    public ID<RJSOperationalPoint> ref;

    public RJSOperationalPointPart(ID<RJSOperationalPoint> ref, double position) {
        super(position);
        this.ref = ref;
    }
}
