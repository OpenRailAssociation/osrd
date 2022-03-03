package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSApplicableDirection;
import fr.sncf.osrd.railjson.schema.common.RJSEdgeDirection;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class SingleDirectionalRJSTrackRange extends RJSTrackRange {
    public RJSEdgeDirection direction;
    public RJSObjectRef<RJSTrackSection> track;

    @Override
    public RJSApplicableDirection getNavigability() {
        if (direction == RJSEdgeDirection.START_TO_STOP)
            return RJSApplicableDirection.NORMAL;
        return RJSApplicableDirection.REVERSE;
    }
}
