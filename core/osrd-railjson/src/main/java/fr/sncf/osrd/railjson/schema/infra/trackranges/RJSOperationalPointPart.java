package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrackObject;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPointPart extends RJSTrackObject {
    public RJSOperationalPointPart(String track, double position) {
        this.track = track;
        this.position = position;
    }
}
