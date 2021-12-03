package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

public class RJSCurve extends BiDirectionalRJSTrackRange {

    // Radius (m).
    public double radius;

    RJSCurve(
            ObjectRef<RJSTrackSection> track,
            double begin,
            double end,
            double radius
    ) {
        super(track, begin, end);
        this.radius = radius;
    }
}
