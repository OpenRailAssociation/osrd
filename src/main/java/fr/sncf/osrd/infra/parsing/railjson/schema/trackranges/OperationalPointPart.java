package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.OperationalPoint;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class OperationalPointPart extends BiDirectionalTrackRange {
    /** The identifier of the operational point this belongs to. */
    public final ID<OperationalPoint> ref;

    OperationalPointPart(ID<OperationalPoint> ref, double start, double end) {
        super(start, end);
        this.ref = ref;
    }
}
